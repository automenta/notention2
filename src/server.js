import {WebSocketServer} from 'ws';
import {InMemoryChatMessageHistory} from '@langchain/core/chat_history';
import {ChatGoogleGenerativeAI} from '@langchain/google-genai';
import {readdir, readFile, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import * as fs from "node:fs";
import react from '@vitejs/plugin-react';
import {createViteServer} from "vitest/node";
import * as http from "node:http";

// Note schema
const Note = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'running', 'completed']).default('pending'),
    logic: z.array(z.object({
        id: z.string(),
        tool: z.string(),
        input: z.any(),
        dependencies: z.array(z.string()).default([]), // Add dependencies
        status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'), // Add step status
    })).optional(),
    memory: z.array(z.any()).default([]),
    references: z.array(z.string()).default([]),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
    updatedAt: z.string().datetime().nullable().default(null),
});

// Filesystem indices
const NOTES_DIR = '../notes';
const TOOLS_BUILTIN_DIR = 'tools';
const TOOLS_DIR = '../tools';
const TESTS_DIR = 'tests';
const GEN_DIR = 'generated';

// Development & seed notes
const devNotes = [
    {
        id: 'dev-1',
        title: 'Core Loop',
        content: 'Full cycle: CRUD, plan, tools',
        status: 'pending',
        tests: ['test-core-loop.js']
    },
    {id: 'dev-2', title: 'Graph UI', content: 'Add D3.js graph later', status: 'pending', references: ['dev-1']},
    {
        id: 'dev-3',
        title: 'Self-Unpacking',
        content: 'Seed generates system',
        status: 'pending',
        logic: [{id: 's1', tool: 'generateCode', input: {description: 'Note CRUD API'}}],
        tests: ['test-self-unpacking.js']
    },
    {
        id: 'dev-4',
        title: 'Tool Chaining',
        content: 'Multi-step plans with refs',
        status: 'pending',
        references: ['dev-1']
    },
];
const seedNote = {
    id: 'seed-0',
    title: 'Netention Seed',
    content: 'Demonstrate planning: search for AI news, summarize, and generate code snippet',
    status: 'pending',
    logic: [
        { id: '1', tool: 'webSearch', input: { query: 'latest AI news' }, dependencies: [], status: 'pending' },
        { id: '2', tool: 'summarize', input: { text: '${1}' }, dependencies: ['1'], status: 'pending' },
        { id: '3', tool: 'generateCode', input: { description: 'Function to process AI news summary: ${2}' }, dependencies: ['2'], status: 'pending' }
    ]
};

// Server state
//const llm = new ChatOpenAI({openAIApiKey: process.env.OPENAI_API_KEY, temperature: 0.7});
const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1, maxRetries: 2});
const notes = new Map();
const tools = new Map();
const memory = new InMemoryChatMessageHistory();

// Load from filesystem
async function loadNotes() {
    fs.mkdirSync(NOTES_DIR, {recursive: true});
    const files = await readdir(NOTES_DIR);
    for (const file of files) {
        const data = JSON.parse(await readFile(join(NOTES_DIR, file), 'utf8'));
        notes.set(data.id, Note.parse(data));
    }
    if (!notes.size) {
        devNotes.concat(seedNote).forEach(n => {
            const note = Note.parse({...n, createdAt: new Date().toISOString()});
            notes.set(note.id, note);
            writeFile(join(NOTES_DIR, `${note.id}.json`), JSON.stringify(note));
        });
    }
}

async function loadTools(path) {
    const files = await readdir(path);
    for (const file of files) {
        let i = "./" + path + "/" + file;
        const {default: tool} = await import(i);
        tools.set(file.replace('.js', ''), tool);
    }
}

// Core loop with anticipation
async function runNote(noteId) {
    const note = notes.get(noteId);
    if (!note) return null;
    note.status = 'running';
    note.updatedAt = new Date().toISOString();
    await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
    wss.clients.forEach(client => client.send(JSON.stringify({type: 'noteUpdate', data: note })));

    try {
        await memory.addMessage({ role: 'user', content: `${note.title}: ${note.content}` });
        const refs = note.references.map(id => notes.get(id)).filter(Boolean);

        if (!note.logic?.length) {
            const previousMessages = await memory.getMessages();
            const systemPrompt = {
                role: 'system',
                content: `Generate a JSON plan with steps that include { id, tool, input, dependencies }. Each step's id should be unique, and dependencies should be an array of step ids that must be completed before this step. In the input, use placeholders like "\${stepId}" to reference the output of previous steps. For example: [{"id": "1", "tool": "webSearch", "input": {"query": "weather"}, "dependencies": []}, {"id": "2", "tool": "summarize", "input": {"text": "\${1}"}, "dependencies": ["1"]}]. Anticipate using references: ${JSON.stringify(refs.map(r => ({ id: r.id, title: r.title, content: r.content })))}`
            };
            const messages = [...previousMessages, systemPrompt];
            const plan = await llm.invoke(messages);
            note.logic = JSON.parse(plan.content);
            note.memory.push({ type: 'system', content: 'Plan generated', timestamp: Date.now() });
            note.updatedAt = new Date().toISOString();
            await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
            wss.clients.forEach(client => client.send(JSON.stringify({ type: 'noteUpdate', data: note })));
        }

        // Dependency-based execution
        const stepsById = new Map(note.logic.map(step => [step.id, step]));
        const dependencyCount = new Map(note.logic.map(step => [step.id, step.dependencies.length]));
        const dependents = new Map();
        for (const step of note.logic) {
            for (const depId of step.dependencies) {
                if (!dependents.has(depId)) dependents.set(depId, []);
                dependents.get(depId).push(step.id);
            }
        }
        const readyQueue = note.logic.filter(step => step.dependencies.length === 0).map(step => step.id);

        function replacePlaceholders(obj, memoryMap) {
            if (typeof obj === 'string') {
                return obj.replace(/\$\{([^}]+)\}/g, (match, stepId) => memoryMap.get(stepId) || match);
            } else if (Array.isArray(obj)) {
                return obj.map(item => replacePlaceholders(item, memoryMap));
            } else if (typeof obj === 'object' && obj !== null) {
                const newObj = {};
                for (const key in obj) {
                    newObj[key] = replacePlaceholders(obj[key], memoryMap);
                }
                return newObj;
            }
            return obj;
        }

        while (readyQueue.length > 0) {
            const stepId = readyQueue.shift();
            const step = stepsById.get(stepId);
            step.status = 'running';
            note.updatedAt = new Date().toISOString();
            await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
            wss.clients.forEach(client => client.send(JSON.stringify({ type: 'noteUpdate', data: note })));

            const tool = tools.get(step.tool);
            if (tool) {
                try {
                    const memoryMap = new Map(note.memory.filter(m => m.type === 'tool' && m.stepId).map(m => [m.stepId, m.content]));
                    const input = replacePlaceholders(step.input, memoryMap);
                    const result = await tool.invoke(input);
                    note.memory.push({ type: 'tool', stepId: step.id, content: result, timestamp: Date.now() });
                    await memory.addMessage({ role: 'assistant', content: JSON.stringify(result) });
                    step.status = 'completed';
                } catch (err) {
                    step.status = 'failed';
                    note.memory.push({ type: 'error', stepId: step.id, content: err.message, timestamp: Date.now() });
                }
            } else {
                step.status = 'failed';
                note.memory.push({ type: 'error', stepId: step.id, content: 'Tool not found', timestamp: Date.now() });
            }

            const dependentIds = dependents.get(stepId) || [];
            for (const depId of dependentIds) {
                const count = dependencyCount.get(depId);
                if (count > 0) {
                    dependencyCount.set(depId, count - 1);
                    if (count - 1 === 0) readyQueue.push(depId);
                }
            }

            note.updatedAt = new Date().toISOString();
            await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
            wss.clients.forEach(client => client.send(JSON.stringify({ type: 'noteUpdate', data: note })));
        }

        const allCompleted = note.logic.every(step => step.status === 'completed');
        const hasFailed = note.logic.some(step => step.status === 'failed');
        note.status = allCompleted ? 'completed' : hasFailed ? 'failed' : 'pending';
    } catch (err) {
        note.status = 'failed';
        note.memory.push({ type: 'error', content: err.message, timestamp: Date.now() });
    }

    note.updatedAt = new Date().toISOString();
    await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
    wss.clients.forEach(client => client.send(JSON.stringify({ type: 'noteUpdate', data: note })));
    return note;
}
