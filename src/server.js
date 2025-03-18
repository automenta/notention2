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
        dependencies: z.array(z.string()).default([]),
        status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
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
    content: 'Demonstrate planning: summarize content and generate code from it',
    status: 'pending',
    logic: [
        { id: '1', tool: 'summarize', input: { text: 'This is a demo of Netention, a system for active notes.' }, dependencies: [], status: 'pending' },
        { id: '2', tool: 'generateCode', input: { description: 'Function to display summary: ${1}' }, dependencies: ['1'], status: 'pending' }
    ]
};

// Server state
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

async function removeReferences(noteId) {
    for (const [id, note] of notes.entries()) {
        if (note.references.includes(noteId)) {
            note.references = note.references.filter(ref => ref !== noteId);
            await writeFile(join(NOTES_DIR, `${id}.json`), JSON.stringify(note));
        }
    }
}

// Core loop with anticipation
async function runNote(noteId) {
    const note = notes.get(noteId);
    if (!note) return null;
    note.status = 'running';
    note.updatedAt = new Date().toISOString();
    await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
    // Send initial update
    wss.clients.forEach(client => client.send(JSON.stringify({ type: 'notes', data: [...notes.values()] })));

    try {
        await memory.addMessage({ role: 'user', content: `${note.title}: ${note.content}` });
        const refs = note.references.map(id => notes.get(id)).filter(Boolean);

        if (!note.logic?.length) {
            const previousMessages = await memory.getMessages();
            const systemPrompt = {
                role: 'system',
                content: `Generate a JSON plan with steps: { id, tool, input, dependencies }. Default to a single step using "summarize" on the note's content if no specific plan is needed. Example: [{"id": "1", "tool": "summarize", "input": {"text": "Note content"}, "dependencies": []}]`
            };
            const messages = [...previousMessages, systemPrompt, { role: 'user', content: note.content }];
            const plan = await llm.invoke(messages);
            note.logic = JSON.parse(plan.content);
            if (!note.logic.length) {
                note.logic = [{ id: crypto.randomUUID(), tool: 'summarize', input: { text: note.content }, dependencies: [], status: 'pending' }];
            }
            note.memory.push({ type: 'system', content: 'Default plan generated', timestamp: Date.now() });
            note.updatedAt = new Date().toISOString();
            await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
        }

        // Dependency-based execution
        const stepsById = new Map(note.logic.map(step => [step.id, step]));
        const dependencies = new Map(note.logic.map(step => [step.id, new Set(step.dependencies)]));
        const readyQueue = note.logic.filter(step => step.dependencies.length === 0).map(step => step.id);
        let changesMade = false;

        while (readyQueue.length > 0) {
            const stepId = readyQueue.shift();
            const step = stepsById.get(stepId);
            if (step.status !== 'pending') continue;

            step.status = 'running';
            changesMade = true;

            const tool = tools.get(step.tool);
            if (tool) {
                try {
                    const memoryMap = new Map(note.memory.filter(m => m.type === 'tool' && m.stepId).map(m => [m.stepId, typeof m.content === 'object' ? JSON.stringify(m.content) : m.content]));
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
                note.memory.push({ type: 'error', stepId: step.id, content: `Tool ${step.tool} not found`, timestamp: Date.now() });
            }

            for (const [id, deps] of dependencies.entries()) {
                deps.delete(stepId);
                if (deps.size === 0 && stepsById.get(id).status === 'pending') {
                    readyQueue.push(id);
                }
            }
        }

        const allCompleted = note.logic.every(step => step.status === 'completed');
        const hasFailed = note.logic.some(step => step.status === 'failed');
        note.status = allCompleted ? 'completed' : (hasFailed && !changesMade) ? 'failed' : 'pending';

        if (changesMade) {
            note.updatedAt = new Date().toISOString();
            await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
            wss.clients.forEach(client => client.send(JSON.stringify({ type: 'notes', data: [...notes.values()] })));
        }
    } catch (err) {
        note.status = 'failed';
        note.memory.push({ type: 'error', content: err.message, timestamp: Date.now() });
        note.updatedAt = new Date().toISOString();
        await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
        wss.clients.forEach(client => client.send(JSON.stringify({ type: 'notes', data: [...notes.values()] })));
    }

    return note;
}

function replacePlaceholders(input, memoryMap) {
    if (typeof input === 'string') {
        let replacedInput = input;
        for (const [stepId, output] of memoryMap.entries()) {
            replacedInput = replacedInput.replace(new RegExp(`\\\$\{\s*${stepId}\s*\}`, 'g'), output);
        }
        return replacedInput;
    } else if (typeof input === 'object' && input !== null) {
        const replacedObject = {};
        for (const key in input) {
            if (Object.hasOwnProperty.call(input, key)) {
                replacedObject[key] = replacePlaceholders(input[key], memoryMap);
            }
        }
        return replacedObject;
    }
    return input;
}


// Combined HTTP and WebSocket server
let wss; // Define wss in outer scope so runNote can access it

async function startServer() {
    // Create Vite dev server in middleware mode
    const vite = await createViteServer({
        root: "client",
        plugins: [react()],
        server: {
            middlewareMode: true,
        },
    });

    // Create HTTP server
    const httpServer = http.createServer((req, res) => {
        vite.middlewares.handle(req, res);
    });

    // Attach WebSocket server to the HTTP server
    wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', ws => {
        console.log('Client connected');
        ws.send(JSON.stringify({ type: 'notes', data: [...notes.values()] }));

        ws.on('message', async (msg) => {
            const { type, ...data } = JSON.parse(msg);

            if (type === 'createNote') {
                const id = crypto.randomUUID();
                const note = Note.parse({ id, title: data.title, content: '', createdAt: new Date().toISOString() });
                notes.set(id, note);
                await writeFile(join(NOTES_DIR, `${id}.json`), JSON.stringify(note));
            }

            if (type === 'updateNote') {
                const note = notes.get(data.id);
                if (note) {
                    const updated = Note.parse({ ...note, ...data, updatedAt: new Date().toISOString() });
                    notes.set(data.id, updated);
                    await writeFile(join(NOTES_DIR, `${data.id}.json`), JSON.stringify(updated));
                }
            }

            if (type === 'deleteNote') {
                await removeReferences(data.id); // Add this line before deletion
                notes.delete(data.id);
                await unlink(join(NOTES_DIR, `${data.id}.json`)).catch(() => {});
            }

            if (type === 'runNote') {
                const updated = await runNote(data.id);
                if (updated) notes.set(data.id, updated);
            }

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'notes', data: [...notes.values()] }));
                }
            });
        });

        ws.on('close', () => console.log('Client disconnected'));
    });

    // Start the combined server
    const PORT = 8080;
    httpServer.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT} (HTTP + WebSocket)`);
    });

    return { vite, httpServer, wss };
}

// Start everything
async function initialize() {
    await loadNotes();
    await loadTools(TOOLS_BUILTIN_DIR);
    fs.mkdirSync(TOOLS_DIR, { recursive: true });
    await loadTools(TOOLS_DIR);
    console.log('Notes and tools loaded');
    await startServer();
}

initialize().catch(console.error);
