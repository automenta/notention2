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
import crypto from 'crypto';
import { GraphEngine } from './graphEngine.js';
import { ToolRegistry } from './toolRegistry.js';
import { LLMInterface } from './llmInterface.js';
import { Executor } from './executor.js';
import { FileManager } from './fileManager.js'; // Import FileManager

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory constants
export const NOTES_DIR = './data/notes';
const TOOLS_BUILTIN_DIR = './tools/builtin';
const TOOLS_DIR = './tools/user';
const TESTS_DIR = 'tests';
const GEN_DIR = 'generated';

// Note schema with enhanced fields
export const NoteSchema = z.object({
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
    resourceBudget: z.object({ // Intrinsic Resource Management
        tokens: z.number().int().default(1000),
        memoryBytes: z.number().int().default(1024 * 1024),
        cpuUnits: z.number().int().default(100) // Abstract CPU units
    }).default({}),
    config: z.record(z.any()).optional() // Type-specific configurations
});

// Server state
const graphEngine = new GraphEngine();
const toolRegistry = new ToolRegistry();
const llmInterface = new LLMInterface();
const executor = new Executor(toolRegistry);
const fileManager = new FileManager(NOTES_DIR); // Instantiate FileManager
export const notes = fileManager.notes; // Reference to notes in fileManager
export const tools = toolRegistry.tools;
const memory = new InMemoryChatMessageHistory();
const queue = new PriorityQueue((a, b) => b.state.priority - a.state.priority);

class NoteImpl {
    constructor(data) {
        Object.assign(this, NoteSchema.parse(data));
    }

    async run() {
        if (this.status !== 'pending') return;
        this.status = 'running';
        await this.save();
        broadcastNotes();

        try {
            for (const step of this.logic || []) {
                if (step.status === 'pending') {
                    const tool = toolRegistry.getTool(step.tool);
                    if (tool) {
                        const result = await tool.invoke(step.input);
                        this.memory.push({ type: 'tool_result', content: result, timestamp: Date.now() });
                        step.status = 'completed';
                    } else {
                        step.status = 'failed';
                        this.memory.push({ type: 'error', content: `Tool ${step.tool} not found`, timestamp: Date.now() });
                    }
                }
            }
            this.status = 'completed';
        } catch (error) {
            this.status = 'failed';
            this.memory.push({ type: 'error', content: error.message, timestamp: Date.now() });
        }
        await this.save();
        broadcastNotes();
    }

    async reflect() {
        this.priority += 1;
        this.memory.push({ type: 'system', content: `Priority increased to ${this.priority}`, timestamp: Date.now() });
        await this.save();
    }

    async handleFailure(error) {
        console.error(error);
        this.status = 'failed';
        this.memory.push({ type: 'error', content: error.message, timestamp: Date.now() });
        await this.save();
    }

    getLogicRunnable() {
        return this.status === 'pending' && this.logic?.some(step => step.status === 'pending');
    }

    scheduleNextRun() {
        setTimeout(() => this.run(), this.calculateRunDelay());
    }

    calculateRunDelay() {
        return this.deadline ? Math.max(0, new Date(this.deadline) - Date.now()) : 1000;
    }

    async save() {
        this.updatedAt = new Date().toISOString();
        await fileManager.saveNote(this); // Use fileManager to save
    }
}

// Load from filesystem - REMOVED - now in FileManager

async function removeReferences(noteId) {
    await fileManager.removeReferences(noteId); // Use fileManager
}

function broadcastNotes() {
    wss.clients.forEach(client => {
        const notesArray = fileManager.getNotes(); // Use fileManager to get notes
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
        ws.send(JSON.stringify({ type: 'notes', data: fileManager.getNotes() })); // Use fileManager

        ws.on('message', async (msg) => {
            const { type, ...data } = JSON.parse(msg);

            if (type === 'createNote') {
                const id = crypto.randomUUID();
                const note = NoteSchema.parse({ id, title: data.title, content: '', createdAt: new Date().toISOString() });
                notes.set(id, note);
                await fileManager.saveNote(note); // Use fileManager
                broadcastNotes();
            }

            if (type === 'updateNote') {
                const note = notes.get(data.id);
                if (note) {
                    const updated = NoteSchema.parse({ ...note, ...data, updatedAt: new Date().toISOString() });
                    notes.set(data.id, updated);
                    await fileManager.saveNote(updated); // Use fileManager
                }
            }

            if (type === 'deleteNote') {
                await removeReferences(data.id); // Use fileManager
                notes.delete(data.id);
                await fileManager.deleteNote(data.id); // Use fileManager
                broadcastNotes();
            }

            if (type === 'runNote') {
                const note = notes.get(data.id);
                if (note) await note.run();
            }

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'notes', data: fileManager.getNotes() })); // Use fileManager
                }
            });
        });

        ws.on('close', () => console.log('Client disconnected'));
    });

    // Load initial notes and tools
    await toolRegistry.loadTools(TOOLS_BUILTIN_DIR);
    fs.mkdirSync(TOOLS_DIR, { recursive: true });
    await toolRegistry.loadTools(TOOLS_DIR);
    await fileManager.loadNotes(); // Load notes using fileManager

    // Seed notes if none exist
    if (fileManager.getNotes().length === 0) {
        devNotes.concat(seedNote).forEach(n => {
            const note = NoteSchema.parse({ ...n, createdAt: new Date().toISOString() });
            notes.set(note.id, note);
            fileManager.saveNote(note); // Use fileManager
        });
    }

    // Start the combined server
    const port = process.env.PORT || 8080;
    httpServer.listen(port, () => {
        console.log(`Server running on //localhost:${port} (HTTP + WebSocket)`);
    });

    return { vite, httpServer, wss };
}

// Start everything
startServer().catch(console.error);
