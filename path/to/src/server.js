import {WebSocketServer} from 'ws';
import {InMemoryChatMessageHistory} from '@langchain/core/chat_history';
import {ChatGoogleGenerativeAI} from '@langchain/google-genai';
import {readdir, readFile, unlink, writeFile} from 'node:fs/promises';
import {join} from 'path';
import {z} from 'zod';
import * as fs from "node:fs";
import react from '@vitejs/plugin-react';
import {createViteServer} from "vitest/node";
import * as http from "node:http";

// === Configuration ===
const CONFIG = {
    NOTES_DIR: './data/notes',
    TOOLS_BUILTIN_DIR: './tools/builtin',
    TOOLS_DIR: './tools/user',
    TESTS_DIR: './tests',
    PORT: 8080,
    RECONNECT_DELAY: 1000,
    TOOL_TIMEOUT: 30000,
    BATCH_INTERVAL: 1000,
    MAX_PRIORITY: 100,
    QUEUE_INTERVAL: 100,
};

// === Schemas ===
const NoteSchema = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
    priority: z.number().min(0).max(CONFIG.MAX_PRIORITY).default(50),
    deadline: z.string().datetime().nullable().optional(),
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
    tests: z.array(z.string()).optional(),
});

// === Initial Data ===
const INITIAL_NOTES = [
    {id: 'dev-1', title: 'Core Loop', content: 'Full cycle: CRUD, plan, tools', status: 'pending', tests: ['test-core-loop.js'], priority: 80},
    {id: 'dev-2', title: 'Graph UI', content: 'Add D3.js graph later', status: 'pending', references: ['dev-1'], priority: 60},
    {id: 'dev-3', title: 'Self-Unpacking', content: 'Seed generates system', status: 'pending', logic: [{id: 's1', tool: 'generateCode', input: {description: 'Note CRUD API'}}], tests: ['test-self-unpacking.js'], priority: 90},
    {id: 'dev-4', title: 'Tool Chaining', content: 'Multi-step plans with refs', status: 'pending', references: ['dev-1'], priority: 70},
    {
        id: 'seed-0',
        title: 'Netention Seed',
        content: 'Demonstrate planning: summarize content and generate code from it',
        status: 'pending',
        priority: 100,
        logic: [
            {id: '1', tool: 'summarize', input: {text: 'This is a demo of Netention, a system for active notes.'}, dependencies: [], status: 'pending'},
            {id: '2', tool: 'generateCode', input: {description: 'Function to display summary: ${1}'}, dependencies: ['1'], status: 'pending'}
        ]
    }
];

// === State Management ===
class ServerState {
    constructor() {
        this.llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1, maxRetries: 2});
        this.notes = new Map();
        this.tools = new Map();
        this.memory = new InMemoryChatMessageHistory();
        this.wss = null;
        this.messageQueue = [];
        this.pendingWrites = new Map();
        this.updateBatch = new Set();
        this.batchTimeout = null;
        this.executionQueue = [];
    }

    log(message, level = 'info') {
        console[level](`[${new Date().toISOString()}] ${message}`);
    }

    timeoutPromise(promise, ms) {
        return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
    }
}

// === Server Implementation ===
class NetentionServer {
    constructor() {
        this.state = new ServerState();
    }

    // === File Operations ===
    async loadTools(path) {
        const files = await readdir(path).catch(() => []);
        for (const f of files) {
            const i = join(path, f);
            try {
                const {default: tool} = await import("./" + i);
                this.state.tools.set(f.replace('.js', ''), tool);
                this.state.log(`Imported tool: ${i}`);
            } catch (e) {
                this.state.log(`Error importing tool ${i}: ${e}`, 'warn');
            }
        }
    }

    async loadNotes() {
        fs.mkdirSync(CONFIG.NOTES_DIR, {recursive: true});
        const files = await readdir(CONFIG.NOTES_DIR).catch(() => []);
        for (const f of files) {
            const data = JSON.parse(await readFile(join(CONFIG.NOTES_DIR, f), 'utf8'));
            const note = NoteSchema.parse(data);
            this.state.notes.set(note.id, note);
            this.queueExecution(note);
        }
        if (!this.state.notes.size) {
            for (const n of INITIAL_NOTES) {
                const note = NoteSchema.parse({...n, createdAt: new Date().toISOString()});
                this.state.notes.set(note.id, note);
                await this.writeNote(note);
                this.queueExecution(note);
            }
        }
    }

    async writeNote(note) {
        const path = join(CONFIG.NOTES_DIR, `${note.id}.json`);
        if (this.state.pendingWrites.has(path)) {
            clearTimeout(this.state.pendingWrites.get(path));
        }
        return new Promise(resolve => {
            const timeout = setTimeout(async () => {
                try {
                    await writeFile(path, JSON.stringify(note));
                    this.state.pendingWrites.delete(path);
                    this.state.updateBatch.add(note.id);
                    this.scheduleBatchUpdate();
                    resolve();
                } catch (e) {
                    this.state.log(`Write failed for ${path}: ${e}`, 'error');
                }
            }, 100);
            this.state.pendingWrites.set(path, timeout);
        });
    }

    async removeReferences(noteId) {
        for (const [id, note] of this.state.notes) {
            if (note.references.includes(noteId)) {
                note.references = note.references.filter(ref => ref !== noteId);
                note.updatedAt = new Date().toISOString();
                await this.writeNote(note);
            }
        }
    }

    // === Execution Logic ===
    queueExecution(note) {
        const priority = note.deadline ?
            Math.min(CONFIG.MAX_PRIORITY, note.priority + Math.floor((new Date(note.deadline) - Date.now()) / 1000)) :
            note.priority;
        const index = this.state.executionQueue.findIndex(item => item.priority < priority);
        if (index === -1) this.state.executionQueue.push({noteId: note.id, priority});
        else this.state.executionQueue.splice(index, 0, {noteId: note.id, priority});
    }

    async processQueue() {
        while (this.state.executionQueue.length) {
            const {noteId} = this.state.executionQueue.shift();
            await this.runNote(noteId);
        }
    }

    async runNote(noteId) {
        const note = this.state.notes.get(noteId);
        if (!note) return null;

        try {
            note.status = 'running';
            note.updatedAt = new Date().toISOString();
            await this.writeNote(note);

            await this.state.memory.addMessage({role: 'user', content: `${note.title}: ${note.content}`});

            if (!note.logic?.length) {
                const previousMessages = await this.state.memory.getMessages();
                const systemPrompt = {
                    role: 'system',
                    content: `Generate a JSON plan using tools: ${[...this.state.tools.keys()].join(', ')}. Default to "summarize" if unsure. Format: [{id, tool, input, dependencies}]`
                };
                // Ensure system message is first
                const messages = [systemPrompt, ...previousMessages, {role: 'user', content: note.content}];
                const plan = await this.state.timeoutPromise(this.state.llm.invoke(messages), CONFIG.TOOL_TIMEOUT);
                note.logic = JSON.parse(plan.content) || [{
                    id: crypto.randomUUID(),
                    tool: 'summarize',
                    input: {text: note.content},
                    dependencies: [],
                    status: 'pending'
                }];
                note.memory.push({type: 'system', content: 'Generated plan', timestamp: Date.now()});
                await this.writeNote(note);
            }

            const stepsById = new Map(note.logic.map(step => [step.id, step]));
            const dependencies = new Map(note.logic.map(step => [step.id, new Set(step.dependencies)]));
            const readyQueue = note.logic.filter(step => !step.dependencies.length).map(step => step.id);
            let changesMade = false;

            while (readyQueue.length) {
                const stepId = readyQueue.shift();
                const step = stepsById.get(stepId);
                if (step.status !== 'pending') continue;

                step.status = 'running';
                changesMade = true;

                const tool = this.state.tools.get(step.tool);
                if (tool) {
                    try {
                        const memoryMap = new Map(note.memory.filter(m => m.stepId).map(m => [m.stepId, typeof m.content === 'object' ? JSON.stringify(m.content) : m.content]));
                        const input = this.replacePlaceholders(step.input, memoryMap);
                        const result = await this.state.timeoutPromise(tool.invoke(input), CONFIG.TOOL_TIMEOUT);
                        note.memory.push({type: 'tool', stepId: step.id, content: result, timestamp: Date.now()});
                        await this.state.memory.addMessage({role: 'assistant', content: JSON.stringify(result)});

                        // Anticipatory actions
                        switch (step.tool) {
                            case 'ml_train':
                                this.queueExecution({id: result, priority: note.priority - 10});
                                break;
                            case 'test_gen':
                                const testNoteId = await this.state.tools.get('spawn')?.invoke({content: {type: 'test', code: result}});
                                if (testNoteId) note.tests = (note.tests || []).concat(testNoteId);
                                break;
                            case 'schedule':
                                this.scheduleNote(result);
                                break;
                        }

                        step.status = 'completed';
                    } catch (err) {
                        step.status = 'failed';
                        note.memory.push({type: 'error', stepId: step.id, content: err.message, timestamp: Date.now()});
                    }
                } else {
                    step.status = 'failed';
                    note.memory.push({type: 'error', stepId: step.id, content: `Tool ${step.tool} not found`, timestamp: Date.now()});
                }

                for (const [id, deps] of dependencies) {
                    deps.delete(stepId);
                    if (!deps.size && stepsById.get(id).status === 'pending') {
                        readyQueue.push(id);
                    }
                }
            }

            const allCompleted = note.logic.every(step => step.status === 'completed');
            const hasFailed = note.logic.some(step => step.status === 'failed');
            note.status = allCompleted ? 'completed' : (hasFailed && !changesMade) ? 'failed' : 'pending';

            if (note.tests?.length && note.status === 'completed') {
                for (const testId of note.tests) {
                    await this.state.tools.get('test_run')?.invoke({testId});
                }
            }

            if (changesMade) {
                note.updatedAt = new Date().toISOString();
                await this.writeNote(note);
            }
        } catch (err) {
            note.status = 'failed';
            note.memory.push({type: 'error', content: err.message, timestamp: Date.now()});
            await this.writeNote(note);
            this.state.log(`Error running note ${noteId}: ${err}`, 'error');
        }

        return note;
    }

    replacePlaceholders(input, memoryMap) {
        if (typeof input === 'string') {
            return Array.from(memoryMap.entries()).reduce((str, [stepId, output]) =>
                str.replace(new RegExp(`\\\$\{\s*${stepId}\s*\}`, 'g'), output), input);
        }
        if (typeof input === 'object' && input !== null) {
            return Object.fromEntries(
                Object.entries(input).map(([key, value]) => [key, this.replacePlaceholders(value, memoryMap)])
            );
        }
        return input;
    }

    // === Scheduling ===
    scheduleNote({noteId, time}) {
        const note = this.state.notes.get(noteId);
        if (note) {
            note.deadline = time;
            setTimeout(() => this.queueExecution(note), new Date(time) - Date.now());
        }
    }

    // === Graph Operations ===
    async updateGraph(noteId) {
        const note = this.state.notes.get(noteId);
        if (!note) return;
        const graphTool = this.state.tools.get('graph_traverse');
        if (graphTool) {
            const result = await graphTool.invoke({startId: noteId, mode: 'bfs', callback: 'update'});
            note.memory.push({type: 'graph', content: result, timestamp: Date.now()});
            await this.writeNote(note);
        }
    }

    // === WebSocket Management ===
    broadcast(message) {
        const msgStr = JSON.stringify(message);
        if (this.state.wss) {
            this.state.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msgStr);
                } else {
                    this.state.messageQueue.push({client, message: msgStr});
                }
            });
        } else {
            this.state.messageQueue.push({message: msgStr});
        }
    }

    scheduleBatchUpdate() {
        if (!this.state.batchTimeout) {
            this.state.batchTimeout = setTimeout(() => {
                if (this.state.updateBatch.size) {
                    this.broadcast({type: 'notes', data: [...this.state.notes.values()]});
                    this.state.updateBatch.clear();
                }
                this.state.batchTimeout = null;
            }, CONFIG.BATCH_INTERVAL);
        }
    }

    async start() {
        const vite = await createViteServer({
            root: "client",
            plugins: [react()],
            server: { middlewareMode: true },
        });

        const httpServer = http.createServer((req, res) => vite.middlewares.handle(req, res));
        this.state.wss = new WebSocketServer({server: httpServer});

        this.state.wss.on('connection', ws => {
            this.state.log('Client connected');
            ws.send(JSON.stringify({type: 'notes', data: [...this.state.notes.values()]}));

            while (this.state.messageQueue.length) {
                const {client, message} = this.state.messageQueue.shift();
                if (!client || client.readyState === WebSocket.OPEN) {
                    (client || ws).send(message);
                }
            }

            ws.on('message', async msg => {
                try {
                    const {type, ...data} = JSON.parse(msg);

                    switch (type) {
                        case 'createNote': {
                            const id = crypto.randomUUID();
                            const note = NoteSchema.parse({id, title: data.title, content: '', createdAt: new Date().toISOString(), priority: data.priority || 50, deadline: data.deadline});
                            this.state.notes.set(id, note);
                            await this.writeNote(note);
                            this.queueExecution(note);
                            break;
                        }
                        case 'updateNote': {
                            const note = this.state.notes.get(data.id);
                            if (note) {
                                const updated = NoteSchema.parse({...note, ...data, updatedAt: new Date().toISOString()});
                                this.state.notes.set(data.id, updated);
                                await this.writeNote(updated);
                                this.queueExecution(updated);
                            }
                            break;
                        }
                        case 'deleteNote': {
                            await this.removeReferences(data.id);
                            this.state.notes.delete(data.id);
                            await unlink(join(CONFIG.NOTES_DIR, `${data.id}.json`)).catch(() => {});
                            break;
                        }
                        case 'runNote': {
                            this.queueExecution(this.state.notes.get(data.id));
                            break;
                        }
                        case 'graphUpdate': {
                            await this.updateGraph(data.id);
                            break;
                        }
                    }

                    this.state.updateBatch.add(data.id || '');
                    this.scheduleBatchUpdate();
                } catch (e) {
                    this.state.log(`WebSocket message error: ${e}`, 'error');
                }
            });

            ws.on('close', () => this.state.log('Client disconnected'));
        });

        httpServer.listen(CONFIG.PORT, () => this.state.log(`Server running on localhost:${CONFIG.PORT}`));
        setInterval(() => this.processQueue(), CONFIG.QUEUE_INTERVAL);
    }

    // === Initialization ===
    async initialize() {
        try {
            fs.mkdirSync(CONFIG.TOOLS_DIR, {recursive: true});
            await Promise.all([
                this.loadTools(CONFIG.TOOLS_BUILTIN_DIR),
                this.loadTools(CONFIG.TOOLS_DIR),
                this.loadNotes()
            ]);
            // Explicitly load new tools (optional for clarity)
            const newTools = ['browser_use', 'computer_use', 'computer_monitor', 'rag', 'mcp'];
            for (const toolName of newTools) {
                try {
                    const {default: tool} = await import(`./tools/builtin/${toolName}.js`);
                    this.state.tools.set(tool.name, tool);
                } catch (e) {
                    this.state.log(`Failed to load ${toolName}: ${e}`, 'warn');
                }
            }
            this.state.log('Notes and tools loaded');
            await this.start();
        } catch (e) {
            this.state.log(`Initialization failed: ${e}`, 'error');
            setTimeout(() => this.initialize(), CONFIG.RECONNECT_DELAY);
        }
    }
}

// === Main Execution ===
const server = new NetentionServer();
server.initialize();
