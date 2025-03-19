import { WebSocketServer } from 'ws';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'path';
import { z } from 'zod';
import * as fs from "node:fs";
import react from '@vitejs/plugin-react';
import { createViteServer } from "vitest/node";
import * as http from "node:http";
import { fileURLToPath } from 'url';
import path from 'path';
import { PriorityQueue } from "@datastructures-js/priority-queue";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory constants
const NOTES_DIR = './data/notes';
const TOOLS_BUILTIN_DIR = './tools/builtin';
const TOOLS_DIR = './tools/user';
const TESTS_DIR = 'tests';
const GEN_DIR = 'generated';

// Note schema with enhanced fields
const NoteSchema = z.object({
    id: z.string(),
    title: z.string(),
    content: z.any(),
    status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
    logic: z.array(z.object({
        id: z.string(),
        tool: z.string(),
        input: z.any(),
        dependencies: z.array(z.string()).default([]),
        status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
    })).optional(),
    memory: z.array(z.object({
        type: z.string(),
        content: z.any(),
        timestamp: z.number(),
    })).default([]),
    references: z.array(z.string()).default([]),
    domains: z.array(z.string()).default([]), // Domain tagging
    deadline: z.string().datetime().nullable().default(null), // Deadlines
    priority: z.number().int().default(0), // Priority
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
    updatedAt: z.string().datetime().nullable().default(null),
});

// Server state
const llm = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash", temperature: 1, maxRetries: 2 });
const notes = new Map();
const tools = new Map();
const memory = new InMemoryChatMessageHistory();
const queue = new PriorityQueue((a, b) => b.priority - a.priority);

// Load from filesystem
async function loadNotes() {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    const files = await readdir(NOTES_DIR);
    for (const file of files) {
        try {
            const data = JSON.parse(await readFile(join(NOTES_DIR, file), 'utf8'));
            const note = NoteSchema.parse(data);
            notes.set(note.id, note);
        } catch (e) {
            console.error(`Error loading note ${file}: ${e}`);
        }
    }
    if (!notes.size) {
        devNotes.concat(seedNote).forEach(n => {
            const note = NoteSchema.parse({ ...n, createdAt: new Date().toISOString() });
            notes.set(note.id, note);
            writeFile(join(NOTES_DIR, `${note.id}.json`), JSON.stringify(note));
        });
    }
}

async function loadTools(path) {
    const files = await readdir(path);
    for (const file of files) {
        try {
            let i = join(path, file);
            const { default: tool } = await import(`file://${i}`);
            tools.set(tool.name, tool);
            console.log(`Loaded tool ${tool.name} from ${path}`);
        } catch (e) {
            console.error(`Error loading tool ${file} from ${path}: ${e}`);
        }
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
    broadcastNotes();

    try {
        await memory.addMessage({ role: 'user', content: `${note.title}: ${note.content}` });
        const refs = note.references.map(id => notes.get(id)).filter(Boolean);
        const memorySummary = note.memory.map(m => `${m.type}: ${m.content}`).join('\n');

        if (!note.logic?.length) {
            const previousMessages = await memory.getMessages();
            const systemPrompt = {
                role: 'system',
                content: `You are an AI assistant generating a plan for an active note in the Netention system. Note details:
    - Title: ${note.title}
    - Content: ${note.content}
    - References: ${note.references.map(ref => notes.get(ref)?.title || 'Unknown').join(', ')}
    - Memory: ${memorySummary}

    Generate a JSON plan with steps: { id, tool, input, dependencies }. Available tools: ${Array.from(tools.keys()).join(', ')}.
    Consider:
    1. The main goal based on content and memory.
    2. Appropriate tools to achieve the goal.
    3. Dependencies between steps.
    4. Anticipate failures and suggest contingencies (e.g., alternative steps).

    Default to [{"id": "1", "tool": "summarize", "input": {"text": "Note content"}, "dependencies": []}] if no specific plan is needed.`
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
                    const memoryMap = new Map(note.memory.filter(m => m.type === 'tool_result' && m.stepId).map(m => [m.stepId, typeof m.content === 'object' ? JSON.stringify(m.content) : m.content]));
                    const input = JSON.parse(JSON.stringify(step.input), (key, value) => {
                        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
                            const depId = value.slice(2, -1);
                            return memoryMap.get(depId) ?? value;
                        }
                        return value;
                    });
                    const result = await tool.invoke(input);
                    note.memory.push({ type: 'tool_result', content: result, timestamp: Date.now() });
                    await memory.addMessage({ role: 'assistant', content: JSON.stringify(result) });
                    step.status = 'completed';
                } catch (err) {
                    step.status = 'failed';
                    note.memory.push({ type: 'error', content: error.message, timestamp: Date.now() });
                }
            } else {
                step.status = 'failed';
                note.memory.push({ type: 'error', content: `Tool ${step.tool} not found`, timestamp: Date.now() });
            }

            for (const [id, deps] of dependencies.entries()) {
                deps.delete(stepId);
                if (deps.size === 0 && stepsById.get(id).status === 'pending') {
                    readyQueue.push(id);
                }
            }
        }

        const allCompleted = note.logic.every(step => step.status === 'completed') ? 'completed' : (hasFailed && !changesMade) ? 'failed' : 'pending';

        if (changesMade) {
            note.updatedAt = new Date().toISOString();
            await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
            broadcastNotes();
        }
    } catch (err) {
        note.status = 'failed';
        note.memory.push({ type: 'error', content: err.message, timestamp: Date.now() });
        note.updatedAt = new Date().toISOString();
        await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
        broadcastNotes();
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

function broadcastNotes() {
    wss.clients.forEach(client => {
        const notesArray = Array.from(notes.values());
        client.send(JSON.stringify({ type: 'notes', data: notesArray }));
    });
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
                const note = NoteSchema.parse({ id, title: data.title, content: '', createdAt: new Date().toISOString() });
                notes.set(id, note);
                await writeFile(join(NOTES_DIR, `${id}.json`), JSON.stringify(note));
                broadcastNotes();
            }

            if (type === 'updateNote') {
                const note = notes.get(data.id);
                if (note) {
                    const updated = NoteSchema.parse({ ...note, ...data, updatedAt: new Date().toISOString() });
                    notes.set(data.id, updated);
                    await writeFile(join(NOTES_DIR, `${data.id}.json`), JSON.stringify(updated));
                }
            }

            if (type === 'deleteNote') {
                await removeReferences(data.id); // Add this line before deletion
                notes.delete(data.id);
                await unlink(join(NOTES_DIR, `${data.id}.json`)).catch(() => { });
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

    // Load initial notes and tools
    await loadTools(TOOLS_BUILTIN_DIR);
    fs.mkdirSync(TOOLS_DIR, { recursive: true });
    await loadTools(TOOLS_DIR);
    loadNotes();

    // Start the combined server
    const port = process.env.PORT || 8080;
    httpServer.listen(port, () => {
        console.log(`Server running on //localhost:${port} (HTTP + WebSocket)`);
    });

    return { vite, httpServer, wss };
}

// Start everything
initialize().catch(console.error);

import { unlink } from 'node:fs/promises';
