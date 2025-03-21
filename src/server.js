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
        this.llm = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash", temperature: 1 });
        this.graph = new Graph();
        this.tools = new Tools();
        this.memory = new InMemoryChatMessageHistory();
        this.wss = null;
        this.messageQueue = [];
        this.pendingWrites = new Map();
        this.updateBatch = new Set();
        this.batchTimeout = null;
        this.executionQueue = [];
        this.db = new Level(CONFIG.DB_PATH, { valueEncoding: 'json' });
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

    async loadTools() {
        await this.state.tools.loadTools(CONFIG.TOOLS_BUILTIN_DIR);
        this.state.log("Loaded builtin tools.", 'info', { component: 'ToolLoader', directory: CONFIG.TOOLS_BUILTIN_DIR });
        await this.state.tools.loadTools(CONFIG.TOOLS_DIR);
        this.state.log("Loaded user tools.", 'info', { component: 'ToolLoader', directory: CONFIG.TOOLS_DIR });
    }

    async loadNotesFromDB() {
        for await (const [key, value] of this.state.db.sublevel('notes').iterator()) {
            try {
                const note = NoteSchema.parse(value);
                this.state.graph.addNote(note);
                for (const ref of note.references) {
                    this.state.graph.addEdge(note.id, ref, 'reference');
                }
                this.queueExecution(note);
            } catch (e) {
                this.state.log(`Error parsing note from DB: ${e}`, 'warn', { component: 'NoteLoader', noteKey: key });
            }
        }
        if (!this.state.graph.getSize()) {
            await this.loadInitialNotes();
        }
    }

    async loadInitialNotes() {
        for (const n of INITIAL_NOTES) {
            try {
                const note = NoteSchema.parse({ ...n, createdAt: new Date().toISOString() });
                await this.writeNoteToDB(note);
                this.state.graph.addNote(note);
                for (const ref of note.references) {
                    this.state.graph.addEdge(note.id, ref, 'reference');
                }
                this.queueExecution(note);
            } catch (e) {
                this.state.log(`Error parsing INITIAL_NOTE: ${e}`, 'error', { component: 'NoteLoader', noteId: n.id, error: e.errors });
            }
        }
    }

    async writeNoteToDB(note) {
        await this.state.db.sublevel('notes').put(note.id, note);
        this.state.updateBatch.add(note.id);
        this.scheduleBatchUpdate();
    }

    async deleteNoteFromDB(noteId) {
        await this.state.db.sublevel('notes').del(noteId);
    }

    async removeReferences(noteId) {
        for (const [id, note] of this.state.graph.graph) {
            if (note.references.includes(noteId)) {
                note.references = note.references.filter(ref => ref !== noteId);
            }
        }
    }

    queueExecution(note) {
        const priority = this.calculatePriority(note);
        const index = this.state.executionQueue.findIndex(item => item.priority < priority);
        if (index === -1) this.state.executionQueue.push({ noteId: note.id, priority });
        else this.state.executionQueue.splice(index, 0, { noteId: note.id, priority });
    }

    calculatePriority(note) {
        return note.deadline ?
            Math.min(CONFIG.MAX_PRIORITY, note.priority + Math.floor((new Date(note.deadline) - Date.now()) / 1000)) :
            note.priority;
    }

    async processQueue() {
        while (this.state.executionQueue.length) {
            const { noteId } = this.state.executionQueue.shift();
            await this.runNote(noteId);
        }
    }

    async runNote(noteId) {
        const note = this.state.graph.getNote(noteId);
        if (!note) {
            this.state.log(`Note ${noteId} not found`, 'warn', { component: 'NoteRunner', noteId: noteId });
            return null;
        }

        try {
            await this._setNoteToRunning(note);
            await this._addNoteToMemory(note);
            if (!note.logic?.length) {
                await this._generateNotePlan(note);
            }
            await this._executeNotePlan(note);
            await this._updateNoteStatusPostExecution(note);
            await this._runNoteTests(note);
            return await this._finalizeNoteRun(note);
        } catch (error) {
            return this._handleNoteError(note, error);
        }
    }

    async _setNoteToRunning(note) {
        note.status = 'running';
        note.updatedAt = new Date().toISOString();
        await this.writeNoteToDB(note);
    }

    async _addNoteToMemory(note) {
        try {
            await this.state.memory.addMessage({ role: 'user', content: `${note.title}: ${note.content}` });
        } catch (memoryError) {
            throw new Error(`Error adding to memory: ${memoryError.message}`);
        }
    }

    async _generateNotePlan(note) {
        try {
            const previousMessages = await this.state.memory.getMessages();
            const systemPrompt = {
                role: 'system',
                content: `Generate a JSON plan using tools: ${[...this.state.tools.tools.keys()].join(', ')}. Default to "summarize" if unsure. Format: [{id, tool, input, dependencies}]`
            };
            const messages = [systemPrompt, ...previousMessages, { role: 'user', content: note.content }];
            const plan = await this.state.timeoutPromise(this.state.llm.invoke(messages), CONFIG.TOOL_TIMEOUT);
            note.logic = JSON.parse(plan.content) || [{
                id: crypto.randomUUID(),
                tool: 'summarize',
                input: { text: note.content },
                dependencies: [],
                status: 'pending'
            }];
            note.memory.push({ type: 'system', content: 'Generated plan', timestamp: Date.now() });
            await this.writeNoteToDB(note);
        } catch (planError) {
            throw new Error(`Error generating plan: ${planError.message}`);
        }
    }

    async _executeNotePlan(note) {
        const stepsById = new Map(note.logic.map(step => [step.id, step]));
        const dependencies = new Map(note.logic.map(step => [step.id, new Set(step.dependencies)]));
        const readyQueue = note.logic.filter(step => !step.dependencies.length).map(step => step.id);

        while (readyQueue.length) {
            const stepId = readyQueue.shift();
            const step = stepsById.get(stepId);
            if (step.status !== 'pending') continue;

            await this._executeStep(note, step, dependencies, stepsById, readyQueue);
        }
    }

    async _executeStep(note, step, dependencies, stepsById, readyQueue) {
        step.status = 'running';
        await this.writeNoteToDB(note);

        const tool = this.state.tools.getTool(step.tool);
        if (!tool) {
            return this._handleToolNotFoundError(note, step);
        }

        try {
            await this._runTool(note, step, tool);
        } catch (toolError) {
            this._handleToolStepError(note, step, toolError);
        } finally {
            this._processStepDependencies(dependencies, stepsById, readyQueue, step.id, note);
        }
    }


    async _runTool(note, step, tool) {
        const memoryMap = new Map(note.memory.filter(m => m.stepId).map(m => [m.stepId, typeof m.content === 'object' ? JSON.stringify(m.content) : m.content]));
        const input = this.replacePlaceholders(step.input, memoryMap);
        const result = await this.state.timeoutPromise(tool.invoke(input, { graph: this.state.graph }), CONFIG.TOOL_TIMEOUT);
        note.memory.push({ type: 'tool', stepId: step.id, content: result, timestamp: Date.now() });
        await this.state.memory.addMessage({ role: 'assistant', content: JSON.stringify(result) });
        await this.writeNoteToDB(note);

        switch (step.tool) {
            case 'ml_train':
                this.queueExecution({ id: result, priority: note.priority - 10 });
                break;
            case 'test_gen':
                const testCode = result;
                const testNoteId = crypto.randomUUID();
                await this._createTestNote(note, testCode, testNoteId);
                break;
            case 'schedule':
                this.scheduleNote(result);
                break;
        }
        step.status = 'completed';
        await this.writeNoteToDB(note);
    }

    async _createTestNote(note, testCode, testNoteId) {
        await this.state.graph.addNote({
            id: testNoteId,
            title: `Test for ${note.id}`,
            content: testCode,
            status: 'pendingUnitTesting', // More specific status for test notes
        });
        this.state.graph.addEdge(testNoteId, note.id, 'tests');
        if (testNoteId) note.tests = (note.tests || []).concat(testNoteId);
        await this.writeNoteToDB(note);
    }


    _processStepDependencies(dependencies, stepsById, readyQueue, stepId, note) {
        for (const [id, deps] of dependencies) {
            deps.delete(stepId);
            if (!deps.size && stepsById.get(id).status === 'pending') {
                readyQueue.push(id);
                this.state.log(`Step ${id} added to readyQueue because dependencies met.`, 'debug', { component: 'NoteRunner', noteId: note.id, stepId: id });
            }
        }
    }


    async _updateNoteStatusPostExecution(note) {
        const allCompleted = note.logic.every(step => step.status === 'completed');
        const hasFailed = note.logic.some(step => step.status === 'failed');
        note.status = allCompleted ? 'completed' : (hasFailed) ? 'failed' : 'pending';
        await this.writeNoteToDB(note);
    }

    async _runNoteTests(note) {
        if (note.tests?.length && note.status === 'completed' && CONFIG.AUTO_RUN_TESTS) { // Check the flag
            note.status = 'pendingUnitTesting'; // Update note status to indicate testing
            await this.writeNoteToDB(note);
            for (const testId of note.tests) {
                const testResult = await this.state.tools.getTool('test_run')?.invoke({ testId }, { graph: this.state.graph });
                note.memory.push({ type: 'testResult', content: `Test ${testId}: ${testResult}`, timestamp: Date.now() });
                if (testResult !== 'Tests passed') {
                    note.status = 'failed'; // If any test fails, mark note as failed
                    await this.writeNoteToDB(note);
                    return; // Exit if tests fail
                }
            }
            if (note.status !== 'failed') {
                note.status = 'completed'; // Only mark as completed if all tests passed and not already failed
                await this.writeNoteToDB(note);
            }
        }
    }


    async _finalizeNoteRun(note) {
        await this.writeNoteToDB(note); // Ensure final state is saved
        return note;
    }

    _handleNoteError(note, error) {
        note.status = 'failed';
        note.memory.push({ type: 'error', content: error.message, timestamp: Date.now() });
        this.state.log(`Error running note ${note.id}: ${error}`, 'error', { component: 'NoteRunner', noteId: note.id, error: error.message });
        this.writeNoteToDB(note);
        return note;
    }

    _handleToolStepError(note, step, error) {
        step.status = 'failed';
        note.memory.push({ type: 'error', stepId: step.id, content: error.message, timestamp: Date.now() });
        this.state.log(`Error running tool ${step.tool} for note ${note.id}: ${error}`, 'error', { component: 'NoteRunner', noteId: note.id, stepId: step.id, toolName: step.tool, error: error.message });
        this.writeNoteToDB(note);
    }

    _handleToolNotFoundError(note, step) {
        step.status = 'failed';
        note.memory.push({
            type: 'error',
            stepId: step.id,
            content: `Tool ${step.tool} not found`,
            timestamp: Date.now()
        });
        this.state.log(`Tool ${step.tool} not found for step ${step.id} in note ${note.id}`, 'error', { component: 'NoteRunner', noteId: note.id, stepId: step.id, toolName: step.tool });
        this.writeNoteToDB(note);
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

    scheduleNote({ noteId, time }) {
        const note = this.state.graph.getNote(noteId);
        if (note) {
            note.deadline = time;
            setTimeout(async () => {
                note.status = 'running';
                this.queueExecution(note);
            }, new Date(time) - Date.now());
        }
    }

    async updateGraph(noteId) {
        const note = this.state.graph.getNote(noteId);
        if (!note) return;
        const graphTool = this.state.tools.getTool('graph_traverse');
        if (graphTool) {
            const result = await graphTool.invoke({ startId: noteId, mode: 'bfs', callback: 'update' }, { graph: this.state.graph });
            note.memory.push({ type: 'graph', content: result, timestamp: Date.now() });
            await this.writeNoteToDB(note);
        }
    }

    broadcast(message) {
        const msgStr = JSON.stringify(message);
        if (this.state.wss) {
            this.state.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msgStr);
                } else {
                    this.state.messageQueue.push({ client, message: msgStr });
                }
            });
        } else {
            this.state.messageQueue.push({ message: msgStr });
        }
    }

    scheduleBatchUpdate() {
        if (!this.state.batchTimeout) {
            this.state.batchTimeout = setTimeout(() => {
                if (this.state.updateBatch.size) {
                    this.broadcast({ type: 'notes', data: this.state.graph.getNotes() });
                    this.state.updateBatch.clear();
                }
                this.state.batchTimeout = null;
            }, CONFIG.BATCH_INTERVAL);
        }
    }

    _handleWebSocketMessage = async (parsedMessage) => {
        try {
            const { type, ...data } = parsedMessage;

            const messageSchema = z.object({
                type: z.string(),
                data: z.any().optional()
            });
            const validatedMessage = messageSchema.parse(parsedMessage);
            const { type: validatedType, data: validatedData } = validatedMessage;

            switch (validatedType) {
                case 'createNote':
                    await this._handleCreateNote(parsedMessage);
                    break;
                case 'updateNote':
                    await this._handleUpdateNote(parsedMessage);
                    break;
                case 'deleteNote':
                    await this._handleDeleteNote(parsedMessage);
                    break;
                case 'runNote':
                    await this._handleRunNote(parsedMessage);
                    break;
                case 'graphUpdate':
                    await this._handleGraphUpdate(parsedMessage);
                    break;
                default:
                    this.state.log(`Unknown WebSocket message type: ${validatedType}`, 'warn', { component: 'WebSocketHandler', messageType: validatedType });
            }

            this.state.updateBatch.add(validatedData?.id || '');
            this.scheduleBatchUpdate();
        } catch (e) {
            if (e instanceof z.ZodError) {
                this.state.log(`WebSocket message validation error: ${e.errors}`, 'warn', { component: 'WebSocketHandler', errorType: 'ValidationError', validationErrors: e.errors });
            } else {
                this.state.log(`WebSocket message processing error: ${e}`, 'error', { component: 'WebSocketHandler', errorType: 'ProcessingError', error: e.message });
            }
        }
    };


    async _handleCreateNote(message) {
        const createNoteSchema = z.object({
            type: z.literal('createNote'),
            title: z.string(),
            priority: z.number().optional(),
            deadline: z.string().datetime().nullable().optional(),
            references: z.array(z.string()).optional()
        });
        const validatedCreateNoteData = createNoteSchema.parse(message);
        const { title, priority, deadline, references } = validatedCreateNoteData;
        const id = crypto.randomUUID();
        const note = NoteSchema.parse({
            id,
            title,
            content: '',
            createdAt: new Date().toISOString(),
            priority: priority || 50,
            deadline,
            references: references || []
        });
        this.state.graph.addNote(note);
        for (const ref of note.references) {
            this.state.graph.addEdge(id, ref, 'reference');
        }
        await this.writeNoteToDB(note);
        this.queueExecution(note);
    }

    async _handleUpdateNote(message) {
        const updateNoteSchema = z.object({
            type: z.literal('updateNote'),
            id: z.string(),
            title: z.string().optional(),
            content: z.string().optional(),
            priority: z.number().optional(),
            deadline: z.string().datetime().nullable().optional(),
            references: z.array(z.string()).optional(),
            logic: z.array(z.any()).optional()
        });
        const validatedUpdateNoteData = updateNoteSchema.parse(message);
        const { id: noteIdToUpdate, title: titleUpdate, content: contentUpdate, priority: priorityUpdate, deadline: deadlineUpdate, references: referencesUpdate, logic: logicUpdate } = validatedUpdateNoteData;
        const note = this.state.graph.getNote(noteIdToUpdate);
        if (note) {
            const updated = NoteSchema.parse({
                ...note,
                title: titleUpdate !== undefined ? titleUpdate : note.title,
                content: contentUpdate !== undefined ? contentUpdate : note.content,
                priority: priorityUpdate !== undefined ? priorityUpdate : note.priority,
                deadline: deadlineUpdate !== undefined ? deadlineUpdate : note.deadline,
                references: referencesUpdate !== undefined ? referencesUpdate : note.references,
                logic: logicUpdate !== undefined ? logicUpdate : note.logic,
                updatedAt: new Date().toISOString()
            });
            this.state.graph.addNote(updated);
            this.state.graph.edges.set(noteIdToUpdate, []);
            for (const ref of updated.references) {
                this.state.graph.addEdge(noteIdToUpdate, ref, 'reference');
            }
            await this.writeNoteToDB(updated);
            this.queueExecution(updated);
        }
    }

    async _handleDeleteNote(message) {
        const deleteNoteSchema = z.object({
            type: z.literal('deleteNote'),
            id: z.string()
        });
        const validatedDeleteNoteData = deleteNoteSchema.parse(message);
        const { id: noteIdToDelete } = validatedDeleteNoteData;
        const updatedNotes = this.state.graph.removeNote(noteIdToDelete);
        for (const note of updatedNotes) {
            await this.writeNoteToDB(note);
        }
        await this.deleteNoteFromDB(noteIdToDelete).catch((e) => {
            this.state.log(`Delete note from DB error: ${e}`, 'error', { component: 'WebSocketHandler', noteId: noteIdToDelete, error: e.message });
        });
    }

    async _handleRunNote(message) {
        const runNoteSchema = z.object({
            type: z.literal('runNote'),
            id: z.string()
        });
        const validatedRunNoteData = runNoteSchema.parse(message);
        const { id: noteIdToRun } = validatedRunNoteData;
        this.queueExecution(this.state.graph.getNote(noteIdToRun));
    }

    async _handleGraphUpdate(message) {
        const graphUpdateSchema = z.object({
            type: z.literal('graphUpdate'),
            id: z.string()
        });
        const validatedGraphUpdateData = graphUpdateSchema.parse(message);
        const { id: noteIdToUpdateGraph } = validatedGraphUpdateData;
        await this.updateGraph(noteIdToUpdateGraph);
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

    async initialize() {
        try {
            this.state.log("Starting initialization...", 'info', { component: 'Server' });
            await this.loadTools();
            await this.loadNotesFromDB();
            this.state.log("Server started successfully.", 'info', { component: 'Server' });
        } catch (e) {
            this.state.log(`Initialization failed: ${e}`, 'error', { component: 'Server', error: e.message });
            //setTimeout(() => this.initialize(), CONFIG.RECONNECT_DELAY);
        }
        await this.start();
    }
}

const server = new NetentionServer();
server.initialize();
