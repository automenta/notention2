import { WebSocketServer } from 'ws';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import react from '@vitejs/plugin-react';
import { Level } from 'level';
import { createViteServer } from "vitest/node";
import * as http from "node:http";
import { Graph } from './graph.js';
import crypto from 'crypto';
import { Tools } from './tools.js';
import { LLM } from './llm.js'; // Import LLM

const CONFIG = {
    DB_PATH: './netention_db',
    TOOLS_BUILTIN_DIR: './tools/builtin',
    TOOLS_DIR: './tools/user',
    TESTS_DIR: './tests',
    PORT: 8080,
    RECONNECT_DELAY: 1000,
    TOOL_TIMEOUT: 30000,
    BATCH_INTERVAL: 1000,
    MAX_PRIORITY: 100,
    QUEUE_INTERVAL: 100,
    DEBUG_LOGGING: true,
    AUTO_RUN_TESTS: false
};

const NoteSchema = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'pendingUnitTesting']).default('pending'),
    priority: z.number().min(0).max(CONFIG.MAX_PRIORITY).default(50),
    deadline: z.string().nullable().optional(),
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

const INITIAL_NOTES = [
    {
        id: 'dev-1',
        title: 'Core Loop',
        content: 'Full cycle: CRUD, plan, tools',
        status: 'pending',
        tests: ['test-core-loop.js'],
        priority: 20
    },
    {
        id: 'dev-2',
        title: 'Graph UI',
        content: 'Add D3.js graph later',
        status: 'pending',
        references: ['dev-1'],
        priority: 20
    },
    {
        id: 'dev-3',
        title: 'Self-Unpacking',
        content: 'Seed generates system',
        status: 'pending',
        logic: [{ id: 's1', tool: 'generateCode', input: { description: 'Note CRUD API' } }],
        tests: ['test-self-unpacking.js'],
        priority: 20
    },
    {
        id: 'dev-4',
        title: 'Tool Chaining',
        content: 'Multi-step plans with refs',
        status: 'pending',
        references: ['dev-1'],
        priority: 20
    },
    {
        id: 'seed-0',
        title: 'Netention Seed',
        content: 'Demonstrate planning: summarize content and generate code from it',
        status: 'pending',
        priority: 100,
        logic: [
            {
                id: '1',
                tool: 'summarize',
                input: { text: 'This is a demo of Netention, a system for active notes.' },
                dependencies: [],
                status: 'pending'
            },
            {
                id: '2',
                tool: 'generateCode',
                input: { description: 'Function to display summary: ${1}' },
                dependencies: ['1'],
                status: 'pending'
            }
        ]
    }
];

class ServerState {
    constructor() {
        this.llm = new LLM(); // Instantiate LLM Class
        this.graph = new Graph();
        this.tools = new Tools();
        this.memory = new InMemoryChatMessageHistory();
        this.wss = null;
        this.messageQueue = [];
        this.pendingWrites = new Map();
        this.updateBatch = new Set();
        this.batchTimeout = null;
        this.executionQueue = new Set(); // Changed to Set
        this.analytics = new Map();
        this.scheduler = null;
    }

    log(message, level = 'info', context = {}) {
        if (level === 'debug' && !CONFIG.DEBUG_LOGGING) {
            return;
        }
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            ...context
        };
        console[level](JSON.stringify(logEntry));
    }

    timeoutPromise(promise, ms) {
        return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
    }
}

class NetentionServer {
    constructor() {
        this.state = new ServerState();
    }

    async initScheduler() {
        this.state.scheduler = setInterval(() => this.optimizeSchedule(), 5000);
    }

    async optimizeSchedule() {
        const notes = [...this.state.graph.getNotes()].filter(n => n.status === 'pending' || n.status === 'running');
        notes.sort((a, b) => this.calculatePriority(b) - this.calculatePriority(a));
        for (const note of notes.slice(0, 10)) {
            if (!this.state.executionQueue.has(note.id)) this.queueExecution(note);
        }
    }

    calculatePriority(note) {
        const deadlineFactor = note.deadline ? (new Date(note.deadline) - Date.now()) / (1000 * 60 * 60) : 0;
        const usage = this.state.analytics.get(note.id)?.usage || 0;
        return (note.priority || 50) - (deadlineFactor < 0 ? 100 : deadlineFactor) + usage;
    }

    async runNote(note) {
        if (this.state.executionQueue.has(note.id)) return note;
        this.state.executionQueue.add(note.id);
        try {
            note.status = 'running';
            await this.writeNoteToDB(note);
            this.updateAnalytics(note, 'start');

            const memoryMap = new Map(note.memory.map(m => [m.stepId || m.timestamp, m.content]));
            const stepsById = new Map(note.logic.map(step => [step.id, step]));
            const dependencies = new Map(note.logic.map(step => [step.id, new Set(step.dependencies)]));
            const readyQueue = note.logic.filter(step => !step.dependencies.length && step.status === 'pending').map(s => s.id);

            while (readyQueue.length) {
                const stepId = readyQueue.shift();
                const step = stepsById.get(stepId);
                step.input = this.replacePlaceholders(step.input, memoryMap);

                switch (step.tool) {
                    case 'collaborate': await this.handleCollaboration(note, step); break;
                    case 'generateTool': await this.handleToolGeneration(note, step); break;
                    case 'knowNote': await this.handleKnowNote(note, step); break;
                    case 'analyze': await this.handleAnalytics(note, step); break;
                    case 'fetchExternal': await this.handleFetchExternal(note, step); break;
                    default: await this.executeStep(note, step, memoryMap);
                }
                this._processStepDependencies(dependencies, stepsById, readyQueue, stepId, note);
            }

            await this._updateNoteStatusPostExecution(note);
            await this._runNoteTests(note);
            await this.pruneMemory(note);
            this.updateAnalytics(note, 'complete');
            return await this._finalizeNoteRun(note);
        } catch (error) {
            return this._handleNoteError(note, error);
        } finally {
            this.state.executionQueue.delete(note.id);
        }
    }

    async handleCollaboration(note, step) {
        const { noteIds } = step.input;
        const collabResult = await this.state.llm.invoke(
            [`Collaborate on "${note.title}" with notes: ${noteIds.join(', ')}`],
            noteIds
        );
        note.memory.push({ type: 'collab', content: collabResult.text, timestamp: Date.now(), stepId: step.id });
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async handleToolGeneration(note, step) {
        const { name, desc, code } = step.input;
        const toolDef = { name, description: desc, schema: z.object({}), invoke: new Function('input', 'context', code) };
        this.state.toolRegistry.set(name, toolDef);
        note.memory.push({ type: 'toolGen', content: `Generated tool ${name}`, timestamp: Date.now(), stepId: step.id });
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async handleKnowNote(note, step) {
        const { title, goal } = step.input;
        const newNoteId = crypto.randomUUID();
        const newNote = {
            id: newNoteId,
            title,
            content: goal,
            status: 'pending',
            logic: [],
            memory: [],
            createdAt: new Date().toISOString(),
        };
        this.state.graph.addNote(newNote);
        note.memory.push({ type: 'know', content: `Knew ${newNoteId}`, timestamp: Date.now(), stepId: step.id });
        step.status = 'completed';
        await this.writeNoteToDB(note);
        this.queueExecution(newNote);
    }

    async handleAnalytics(note, step) {
        const { targetId } = step.input;
        const target = this.state.graph.getNote(targetId);
        if (!target) throw new Error(`Note ${targetId} not found`);
        const analytics = this.state.analytics.get(targetId) || { usage: 0, runtime: 0 };
        const result = `Usage: ${analytics.usage}, Avg Runtime: ${analytics.runtime / (analytics.usage || 1)}ms`;
        note.memory.push({ type: 'analytics', content: result, timestamp: Date.now(), stepId: step.id });
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async handleFetchExternal(note, step) {
        const { apiName, query } = step.input;
        const data = await this.state.llm.fetchExternalData(apiName, query);
        note.memory.push({ type: 'external', content: JSON.stringify(data), timestamp: Date.now(), stepId: step.id });
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async executeStep(note, step, memoryMap) {
        const tool = this.state.toolRegistry.get(step.tool) || this.state.tools.getTool(step.tool);
        if (!tool) return this._handleToolNotFoundError(note, step);
        try {
            const result = await tool.invoke(step.input, { graph: this.state.graph, llm: this.state.llm });
            memoryMap.set(step.id, result);
            note.memory.push({ type: 'tool', content: result, timestamp: Date.now(), stepId: step.id });
            step.status = 'completed';
        } catch (error) {
            this._handleToolStepError(note, step, error);
        }
        await this.writeNoteToDB(note);
    }

    async pruneMemory(note) {
        if (note.memory.length > 100) {
            const summary = await this.state.llm.invoke([`Summarize: ${JSON.stringify(note.memory.slice(0, 50))}`]);
            note.memory = [
                { type: 'summary', content: summary.text, timestamp: Date.now() },
                ...note.memory.slice(-50)
            ];
            await this.writeNoteToDB(note);
        }
    }

    updateAnalytics(note, event) {
        const stats = this.state.analytics.get(note.id) || { usage: 0, runtime: 0, lastStart: 0 };
        if (event === 'start') stats.lastStart = Date.now();
        if (event === 'complete') {
            stats.usage++;
            stats.runtime += Date.now() - stats.lastStart;
        }
        this.state.analytics.set(note.id, stats);
    }

    async initialize() {
        try {
            this.state.log("Starting initialization...", 'info', { component: 'Server' });
            await this.loadTools();
            await this.loadNotesFromDB();
            this.state.llm.setApiKey('exampleApi', 'your-key-here');
            this.state.log("Server started successfully.", 'info', { component: 'Server' });
            await this.start();
            this.initScheduler();
        } catch (e) {
            this.state.log(`Initialization failed: ${e}`, 'error', { component: 'Server', error: e.message });
            //setTimeout(() => this.initialize(), CONFIG.RECONNECT_DELAY);
        }
        await this.start();
    }


    async start() {
        const vite = await createViteServer({
            root: "client",
            plugins: [react()],
            server: { middlewareMode: true },
        });

        const httpServer = http.createServer((req, res) => vite.middlewares.handle(req, res));
        this.state.wss = new WebSocketServer({ server: httpServer });

        this.state.wss.on('connection', ws => {
            this.state.log('Client connected', 'info', { component: 'WebSocketHandler' });
            ws.send(JSON.stringify({ type: 'notes', data: this.state.graph.getNotes() }));

            while (this.state.messageQueue.length) {
                const { client, message } = this.state.messageQueue.shift();
                if (!client || client.readyState === WebSocket.OPEN) {
                    (client || ws).send(message);
                }
            }

            ws.on('message', async msg => {
                try {
                    const parsedMessage = JSON.parse(msg);
                    await this._handleWebSocketMessage(parsedMessage);
                } catch (e) {
                    this.state.log(`WebSocket message processing error: ${e}`, 'error', { component: 'WebSocketHandler', errorType: 'MessageParsingError', error: e.message });
                }
            });


            ws.on('close', () => this.state.log('Client disconnected', 'info', { component: 'WebSocketHandler' }));
        });

        httpServer.listen(CONFIG.PORT, () => this.state.log(`Server running on localhost:${CONFIG.PORT}`, 'info', { component: 'Server', port: CONFIG.PORT }));
        setInterval(() => this.processQueue(), CONFIG.QUEUE_INTERVAL);
    }
}

const server = new NetentionServer();
server.initialize();
