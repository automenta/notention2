import {WebSocketServer} from 'ws';
import {InMemoryChatMessageHistory} from '@langchain/core/chat_history';
import {z} from 'zod';
import react from '@vitejs/plugin-react';
import {createViteServer} from "vitest/node";
import * as http from "node:http";
import {Graph} from './graph.js';
import crypto from 'crypto';
import {Tools} from './tools.js';
import {LLM} from './llm.js'; // Import LLM

const CONFIG = {
    DB_PATH: './netention_db',
    TOOLS_BUILTIN_DIR: './tools',
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
    content: z.any(),
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
        logic: [{id: 's1', tool: 'generateCode', input: {description: 'Note CRUD API'}}],
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
        content: {
            type: "system",
            desc: "Netention: Self-evolving knowledge/task fabric",
            config: { maxMemory: 50, tickRate: 10, decayRate: 7 * 24 * 60 * 60 * 1000, tokenBudget: 10000, defaultPriority: 50, replicationPeers: 5 },
            metamodel: { note: { id: "string", content: "any", graph: "array", state: "object" }, rules: ["know sub-Notes", "prune memory", "sync via IPFS", "test functionality", "learn dynamically"] },
            prompts: {
                "plan": "Generate a plan for: {desc}",
                "optimize": "Refine this code: {src}",
                "summarize": "Summarize: {text}",
                "eval": "Evaluate expression: {expr}",
                "graph": "Analyze graph: {nodes}",
                "test_gen": "Generate unit test for: {code}",
                "train": "Train {model} on: {data}",
                "predict": "Predict with {model}: {input}"
            },
            tools: { // tools moved inside content
                // Existing Tools
                "code_gen": { type: "tool", name: "code_gen", desc: "Generate JS", execute: "langChain.llm" },
                "file_write": { type: "tool", name: "file_write", desc: "Write IPFS", execute: "ipfs.add" },
                "reflect": { type: "tool", name: "reflect", desc: "Self-analyze", execute: "langChain.reflect" },
                "notify": { type: "tool", name: "notify", desc: "User alert", execute: "Express.push" },
                "ui_gen": { type: "tool", name: "ui_gen", desc: "Generate UI", execute: "cytoscape.add" },
                "search": { type: "tool", name: "search", desc: "Web search", execute: "langChain.serpapi" },
                "summarize": { type: "tool", name: "summarize", desc: "Text summary", execute: "langChain.summarize" },
                "know": { type: "tool", name: "know", desc: "Create Note", execute: "db.put" },
                "sync": { type: "tool", name: "sync", desc: "Replicate Notes", execute: "ipfs.pubsub" },
                "learn": { type: "tool", name: "learn", desc: "Train on data", execute: "langChain.vectorStore" },
                "eval_expr": { type: "tool", name: "eval_expr", desc: "Evaluate expressions", execute: "evalExpr" },
                "graph_search": { type: "tool", name: "graph_search", desc: "Search graph", execute: "graphSearch" },
                "graph_traverse": { type: "tool", name: "graph_traverse", desc: "Traverse graph", execute: "graphTraverse" },
                "graph_metrics": { type: "tool", name: "graph_metrics", desc: "Graph metrics", execute: "graphMetrics" },
                // New Testing Tools - using IDs instead of inline definitions for seed note
                "test_gen":  'tool-test_gen-id',
                "test_run":  'tool-test_run-id',
                // New Fundamental Tools - using IDs as placeholders
                "compose": 'tool-compose-id',
                "schedule": 'tool-schedule-id',
                "debug": 'tool-debug-id',
            }
        },
        status: 'running',
        priority: 100,
        logic: [
            {
                id: '1',
                tool: 'summarize',
                input: {text: 'This is a demo of Netention, a system for active notes.'},
                dependencies: [],
                status: 'pending'
            },
            {
                id: '2',
                tool: 'generateCode',
                input: {description: 'Function to display summary: ${1}'},
                dependencies: ['1'],
                status: 'pending'
            },
            {
                id: '3',
                tool: 'reflect', // Add reflect
                input: {noteId: 'seed-0'},
                dependencies: ['2'],
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
                    case 'summarize':
                        await this.handleSummarize(note, step);
                        break;
                    case 'generateCode':
                        await this.handleGenerateCode(note, step);
                        break;
                    case 'reflect': // New Tool - Reflect
                        await this.handleReflect(note, step);
                        break;
                    case 'test_gen': // New Tool - Test Generation
                        await this.handleTestGeneration(note, step);
                        break;
                    case 'test_run': // New Tool - Test Execution
                        await this.handleTestExecution(note, step);
                        break;
                    default:
                        await this.executeStep(note, step, memoryMap);
                }
                this._processStepDependencies(dependencies, stepsById, readyQueue, stepId, note);
            }

            await this._updateNoteStatusPostExecution(note);
            await this._runNoteTests(note);
            await self.pruneMemory(note);
            this.updateAnalytics(note, 'complete');
            return await this._finalizeNoteRun(note);
        } catch (error) {
            return this._handleNoteError(note, error);
        } finally {
            this.state.executionQueue.delete(note.id);
        }
    }

    async handleTestGeneration(note, step) {
        const {code, targetId} = step.input;
        try {
            const testCode = await this.state.tools.executeTool('test_gen', {code, targetId}, {graph: this.state.graph, llm: this.state.llm});
            const testNoteId = crypto.randomUUID();
            const testNote = {
                id: testNoteId,
                title: `Test for ${targetId}`,
                content: {type: 'test', code: testCode},
                status: 'pending',
                priority: 75,
                references: [targetId],
                createdAt: new Date().toISOString()
            };
            this.state.graph.addNote(testNote);
            note.memory.push({type: 'testGen', content: `Generated test ${testNoteId} for ${targetId}`, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.writeNoteToDB(note);
            this.queueExecution(testNote); // Queue the test note for execution immediately
            return testNoteId;
        } catch (error) {
            step.status = 'failed';
            note.memory.push({type: 'testGenError', content: `Test generation failed: ${error.message}`, timestamp: Date.now(), stepId: step.id});
            await this.writeNoteToDB(note);
            return `Test generation failed: ${error.message}`;
        }
    }

    async handleTestExecution(note, step) {
        const {testId} = step.input;
        try {
            const results = await this.state.tools.executeTool('test_run', {testId}, {graph: this.state.graph, llm: this.state.llm});
            note.memory.push({type: 'testRun', content: `Executed test ${testId}: ${results}`, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.writeNoteToDB(note);
            return results;
        } catch (error) {
            step.status = 'failed';
            note.memory.push({type: 'testRunError', content: `Test execution failed: ${error.message}`, timestamp: Date.now(), stepId: step.id});
            await this.writeNoteToDB(note);
            return `Test execution failed: ${error.message}`;
        }
    }


    async handleCollaboration(note, step) {
        const {noteIds} = step.input;
        const collabResult = await this.state.llm.invoke(
            [`Collaborate on "${note.title}" with notes: ${noteIds.join(', ')}`],
            noteIds
        );
        note.memory.push({type: 'collab', content: collabResult.text, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async handleToolGeneration(note, step) {
        const {name, desc, code} = step.input;
        const toolDef = {name, description: desc, schema: z.object({}), invoke: new Function('input', 'context', code)};
        this.state.tools.addTool(toolDef);
        note.memory.push({type: 'toolGen', content: `Generated tool ${name}`, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async handleKnowNote(note, step) {
        const {title, goal} = step.input;
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
        note.memory.push({type: 'know', content: `Knew ${newNoteId}`, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.writeNoteToDB(note);
        this.queueExecution(newNote);
    }

    async handleAnalytics(note, step) {
        const {targetId} = step.input;
        const target = this.state.graph.getNote(targetId);
        if (!target) throw new Error(`Note ${targetId} not found`);
        const analytics = this.state.analytics.get(targetId) || {usage: 0, runtime: 0};
        const result = `Usage: ${analytics.usage}, Avg Runtime: ${analytics.runtime / (analytics.usage || 1)}ms`;
        note.memory.push({type: 'analytics', content: result, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async handleFetchExternal(note, step) {
        const {apiName, query} = step.input;
        const data = await this.state.llm.fetchExternalData(apiName, query);
        note.memory.push({type: 'external', content: JSON.stringify(data), timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async executeStep(note, step, memoryMap) {
        const tool = this.state.tools.getTool(step.tool);
        if (!tool) return this._handleToolNotFoundError(note, step);
        try {
            const result = await tool.execute(step.input, {graph: this.state.graph, llm: this.state.llm}); // Use execute and pass context
            memoryMap.set(step.id, result);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
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
                {type: 'summary', content: summary.text, timestamp: Date.now()},
                ...note.memory.slice(-50)
            ];
            await this.writeNoteToDB(note);
        }
    }

    updateAnalytics(note, event) {
        const stats = this.state.analytics.get(note.id) || {usage: 0, runtime: 0, lastStart: 0};
        if (event === 'start') stats.lastStart = Date.now();
        if (event === 'complete') {
            stats.usage++;
            stats.runtime += Date.now() - stats.lastStart;
        }
        this.state.analytics.set(note.id, stats);
    }

    initialize() {
        this.state.log("Starting initialization...", 'info', {component: 'Server'});
        this.loadTools();
        this.loadNotesFromDB();
        this.state.llm.setApiKey('exampleApi', 'your-key-here');
        this.state.log("Server started successfully.", 'info', {component: 'Server'});
        this.start();
        this.initScheduler();
    }


    async start() {
        const vite = await createViteServer({
            root: "client",
            plugins: [react()],
            server: {middlewareMode: true},
        });

        const httpServer = http.createServer((req, res) => vite.middlewares.handle(req, res));
        this.state.wss = new WebSocketServer({server: httpServer});

        this.state.wss.on('connection', ws => {
            this.state.log('Client connected', 'info', {component: 'WebSocketHandler'});
            ws.send(JSON.stringify({type: 'notes', data: this.state.graph.getNotes()}));

            while (this.state.messageQueue.length) {
                const {client, message} = this.state.messageQueue.shift();
                if (!client || client.readyState === WebSocket.OPEN) {
                    (client || ws).send(message);
                }
            }

            ws.on('message', async msg => {
                try {
                    const parsedMessage = JSON.parse(msg);
                    await this._handleWebSocketMessage(parsedMessage);
                } catch (e) {
                    this.state.log(`WebSocket message processing error: ${e}`, 'error', {
                        component: 'WebSocketHandler',
                        errorType: 'MessageParsingError',
                        error: e.message
                    });
                }
            });


            ws.on('close', () => this.state.log('Client disconnected', 'info', {component: 'WebSocketHandler'}));
        });

        httpServer.listen(CONFIG.PORT, () => this.state.log(`Server running on localhost:${CONFIG.PORT}`, 'info', {
            component: 'Server',
            port: CONFIG.PORT
        }));
        setInterval(() => this.processQueue(), CONFIG.QUEUE_INTERVAL);
    }

    async loadTools() {
        this.state.log("Loading tools...", 'info', {component: 'ToolLoader'});
        await this.state.tools.loadTools(CONFIG.TOOLS_BUILTIN_DIR);
        this.state.log(`Loaded ${this.state.tools.getTools().length} tools.`, 'info', {
            component: 'ToolLoader',
            count: this.state.tools.getTools().length
        });
    }

    async loadNotesFromDB() {
        this.state.log("Loading notes from DB...", 'info', {component: 'NoteLoader'});
        INITIAL_NOTES.forEach(note => this.state.graph.addNote(note));
        this.state.log(`Loaded ${this.state.graph.getNotes().length} notes from DB.`, 'info', {
            component: 'NoteLoader',
            count: this.state.graph.getNotes().length
        });
    }

    async writeNoteToDB(note) {
        this.state.log(`Writing note ${note.id} to DB.`, 'debug', {component: 'NoteWriter', noteId: note.id});
        this.state.updateBatch.add(note.id);
        if (!this.state.batchTimeout) {
            this.state.batchTimeout = setTimeout(this.flushBatchedUpdates.bind(this), CONFIG.BATCH_INTERVAL);
        }
        return new Promise(resolve => this.state.pendingWrites.set(note.id, resolve));
    }

    async flushBatchedUpdates() {
        const noteUpdates = Array.from(this.state.updateBatch).map(noteId => {
            return this.state.graph.getNote(noteId);
        });
        this.state.updateBatch.clear();
        this.state.batchTimeout = null;
        noteUpdates.forEach(note => {
            this.state.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({type: 'noteUpdate', data: note}));
                }
            });
            const resolver = this.state.pendingWrites.get(note.id);
            if (resolver) resolver();
            this.state.pendingWrites.delete(note.id);

        });
    }


    queueExecution(note) {
        this.state.log(`Queueing note ${note.id} for execution.`, 'debug', {
            component: 'ExecutionQueue',
            noteId: note.id
        });
        this.state.executionQueue.add(note.id);
    }

    replacePlaceholders(input, memoryMap) {
        if (typeof input === 'string') {
            return input.replace(/\${(\w+)}/g, (_, stepId) => memoryMap.get(stepId) || '');
        }
        return input;
    }

    _processStepDependencies(dependencies, stepsById, readyQueue, stepId, note) {
        for (const [currentStepId, deps] of dependencies.entries()) {
            if (deps.has(stepId)) {
                deps.delete(stepId);
                if (!deps.size) readyQueue.push(currentStepId);
            }
        }
    }

    async _updateNoteStatusPostExecution(note) {
        const pendingSteps = note.logic.filter(step => step.status === 'pending').length;
        if (!pendingSteps) note.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async _runNoteTests(note) {
        if (!CONFIG.AUTO_RUN_TESTS || !note.tests || !note.tests.length) return;
        for (const testFile of note.tests) {
            try {
                const testModule = await import(`file://${process.cwd()}/${CONFIG.TESTS_DIR}/${testFile}`);
                await testModule.default(note, this.state); // Assuming tests are written as async functions
                this.state.log(`Tests for note ${note.id} passed.`, 'info', {
                    component: 'TestRunner',
                    noteId: note.id,
                    testFile: testFile
                });
            } catch (error) {
                this.state.log(`Tests failed for note ${note.id}: ${error}`, 'error', {
                    component: 'TestRunner',
                    noteId: note.id,
                    testFile: testFile,
                    error: error.message
                });
            }
        }
    }

    async _finalizeNoteRun(note) {
        this.state.log(`Note ${note.id} execution finalized.`, 'debug', {
            component: 'NoteRunner',
            noteId: note.id,
            status: note.status
        });
        return note;
    }

    _handleNoteError(note, error) {
        this.state.log(`Error running note ${note.id}: ${error}`, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            errorType: 'NoteExecutionError',
            error: error.message
        });
        note.status = 'failed';
        note.error = error.message;
        this.writeNoteToDB(note);
        return note;
    }

    _handleToolNotFoundError(note, step) {
        const errorMsg = `Tool ${step.tool} not found`;
        this.state.log(errorMsg, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            stepId: step.id,
            toolName: step.tool,
            errorType: 'ToolNotFoundError'
        });
        step.status = 'failed';
        step.error = errorMsg;
        note.status = 'failed';
        this.writeNoteToDB(note);
        return errorMsg;
    }

    _handleToolStepError(note, step, error) {
        this.state.log(`Error executing tool ${step.tool} for note ${note.id}: ${error}`, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            stepId: step.id,
            toolName: step.tool,
            errorType: 'ToolExecutionError',
            error: error.message
        });
        step.status = 'failed';
        step.error = error.message;
        note.status = 'failed';
        this.writeNoteToDB(note);
        return `Tool execution failed: ${error.message}`;
    }

    async _handleWebSocketMessage(parsedMessage) {
        if (parsedMessage.type === 'createNote') {
            const newNote = {
                id: crypto.randomUUID(),
                title: parsedMessage.title || 'New Note',
                content: '',
                status: 'pending',
                logic: [],
                memory: [],
                createdAt: new Date().toISOString(),
            };
            this.state.graph.addNote(newNote);
            await this.writeNoteToDB(newNote);
            this.queueExecution(newNote);
            this.state.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({type: 'notes', data: this.state.graph.getNotes()}));
                }
            });
        } else if (parsedMessage.type === 'updateNote') {
            const updatedNote = parsedMessage;
            const existingNote = this.state.graph.getNote(updatedNote.id);
            if (existingNote) {
                Object.assign(existingNote, updatedNote);
                existingNote.updatedAt = new Date().toISOString();
                await this.writeNoteToDB(existingNote);
                this.state.wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({type: 'notes', data: this.state.graph.getNotes()}));
                    }
                });
            }
        } else if (parsedMessage.type === 'deleteNote') {
            const noteIdToDelete = parsedMessage.id;
            this.state.graph.removeNote(noteIdToDelete);
            await this.state.graph.removeReferences(noteIdToDelete);
            await this.writeNoteToDB({id: noteIdToDelete}); //still write to trigger update
            this.state.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({type: 'notes', data: this.state.graph.getNotes()}));
                }
            });

        } else {
            this.state.log('Unknown message type', 'warn', {
                component: 'WebSocketHandler',
                messageType: parsedMessage.type
            });
        }
    }

    async processQueue() {
        if (this.state.executionQueue.size === 0) return;
        const noteId = this.state.executionQueue.values().next().value;
        const note = this.state.graph.getNote(noteId);

        if (!note) {
            this.state.executionQueue.delete(noteId);
            return;
        }

        if (note.status !== 'pending' && note.status !== 'running' && note.status !== 'pendingUnitTesting') { // Include pendingUnitTesting
            this.state.executionQueue.delete(noteId);
            return;
        }

        try {
            await this.runNote(note);
        } catch (error) {
            this.state.log(`Error processing note ${note.id} from queue: ${error}`, 'error', {
                component: 'ExecutionQueue',
                noteId: note.id,
                error: error.message
            });
            this.state.executionQueue.delete(noteId);
        } finally {
            this.state.executionQueue.delete(noteId);
        }
    }

    async handleFailure(note, error) {
        this.state.log(`Note ${note.id} execution failed: ${error}`, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            errorType: 'NoteExecutionError'
        });

        if (this.shouldRetry(error)) {
            await this.retryExecution(note);
        } else if (this.shouldRequestUnitTest(note, error)) {
            await this.requestUnitTest(note);
        } else {
            note.status = 'failed'; // Set status to failed if no recovery
            await this.writeNoteToDB(note);
        }
    }


    shouldRetry(error) {
        // Basic retry condition - can be expanded
        return error.message.includes('timeout') || error.message.includes('rate limit');
    }

    async retryExecution(note) {
        note.status = 'pending'; // Reset status to pending for retry
        await this.writeNoteToDB(note);
        this.queueExecution(note); // Re-queue for execution
        this.state.log(`Note ${note.id} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: note.id});
    }


    shouldRequestUnitTest(note, error) {
        // Request unit test if tool execution failed or code generation failed
        return stepErrorTypes.includes(error.errorType) || note.logic.some(step => step.tool === 'code_gen' && step.status === 'failed');
    }


    async requestUnitTest(note) {
        if (!note.tests) note.tests = [];
        const testId = crypto.randomUUID();
        note.tests.push(testId); // Assign a test ID to the note
        note.status = 'pendingUnitTesting';
        await this.writeNoteToDB(note);


        const testNote = {
            id: testId,
            title: `Unit Test for ${note.title}`,
            content: {
                type: 'test',
                targetNoteId: note.id // Reference the note to be tested
            },
            status: 'pending',
            priority: 60, // Higher priority for tests
            createdAt: new Date().toISOString(),
            references: [note.id] // Create reference to the note being tested
        };
        this.state.graph.addNote(testNote);
        await this.writeNoteToDB(testNote);
        this.queueExecution(testNote); // Queue the test note for execution
        this.state.log(`Unit test requested for Note ${note.id}, test Note ${testId} created.`, 'info', {
            component: 'NoteRunner',
            noteId: note.id,
            testNoteId: testId
        });
    }
}

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];


export const NoteSchema = NoteSchema;
export default NetentionServer;
