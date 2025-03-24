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

const INITIAL_NOTES = [ ... keep INITIAL_NOTES as is ... ];

class ServerState { ... keep ServerState as is ... }

class NetentionServer {
    constructor() {
        this.state = new ServerState();
    }

    async initScheduler() { ... keep initScheduler as is ... }

    async optimizeSchedule() { ... keep optimizeSchedule as is ... }

    calculatePriority(note) { ... keep calculatePriority as is ... }

    async runNote(note) { ... keep runNote as is ... }

    async handleTestGeneration(note, step) { ... keep handleTestGeneration as is ... }

    async handleTestExecution(note, step) { ... keep handleTestExecution as is ... }

    async handleCollaboration(note, step) { ... keep handleCollaboration as is ... }

    async handleToolGeneration(note, step) { ... keep handleToolGeneration as is ... }

    async handleKnowNote(note, step) { ... keep handleKnowNote as is ... }

    async handleAnalytics(note, step) { ... keep handleAnalytics as is ... }

    async handleFetchExternal(note, step) { ... keep handleFetchExternal as is ... }

    async executeStep(note, step, memoryMap) { ... keep executeStep as is ... }

    async pruneMemory(note) { ... keep pruneMemory as is ... }

    updateAnalytics(note, event) { ... keep updateAnalytics as is ... }

    initialize() { ... keep initialize as is ... }


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
            // Send available tools on connection
            const availableToolsData = this.state.tools.getTools().map(tool => ({ name: tool.name, description: tool.description, schema: tool.schema })); // Send tool info
            ws.send(JSON.stringify({type: 'tools', data: availableToolsData}));


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

    async loadTools() { ... keep loadTools as is ... }

    async loadNotesFromDB() { ... keep loadNotesFromDB as is ... }

    async writeNoteToDB(note) { ... keep writeNoteToDB as is ... }

    async flushBatchedUpdates() { ... keep flushBatchedUpdates as is ... }


    queueExecution(note) { ... keep queueExecution as is ... }

    replacePlaceholders(input, memoryMap) { ... keep replacePlaceholders as is ... }

    _processStepDependencies(dependencies, stepsById, readyQueue, stepId, note) { ... keep _processStepDependencies as is ... }

    async _updateNoteStatusPostExecution(note) { ... keep _updateNoteStatusPostExecution as is ... }

    async _runNoteTests(note) { ... keep _runNoteTests as is ... }

    async _finalizeNoteRun(note) { ... keep _finalizeNoteRun as is ... }

    _handleNoteError(note, error) { ... keep _handleNoteError as is ... }

    _handleToolNotFoundError(note, step) { ... keep _handleToolNotFoundError as is ... }

    _handleToolStepError(note, step, error) { ... keep _handleToolStepError as is ... }

    async _handleWebSocketMessage(parsedMessage) { ... keep _handleWebSocketMessage as is ... }

    async processQueue() { ... keep processQueue as is ... }

    async handleFailure(note, error) { ... keep handleFailure as is ... }


    shouldRetry(error) { ... keep shouldRetry as is ... }

    async retryExecution(note) { ... keep retryExecution as is ... }


    shouldRequestUnitTest(note, error) { ... keep shouldRequestUnitTest as is ... }


    async requestUnitTest(note) { ... keep requestUnitTest as is ... }
}

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];


export const NoteSchema = NoteSchema;
export default NetentionServer;
