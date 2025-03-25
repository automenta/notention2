import react from '@vitejs/plugin-react';
import { createViteServer } from "vitest/node";
import * as http from "node:http";

import { ServerState } from './server_state.js';
import { ExecutionQueueManager } from './execution_queue_manager.js';
import { WebSocketServerManager } from './websocket_server.js'; // Import WebSocketServerManager


class NetentionServer {
    constructor() {
        this.state = new ServerState();
        this.queueManager = new ExecutionQueueManager(this.state);
        this.websocketServerManager = new WebSocketServerManager(this.state); // Instantiate WebSocketServerManager
    }


    async runNote(note) {
        return this.queueManager.runNote(note);
    }
    async handleTestGeneration(note, step) {
        return this.queueManager.handleTestGeneration(note, step);
    }
    async handleTestExecution(note, step) {
        return this.queueManager.handleTestExecution(note, step);
    }
    async handleCollaboration(note, step) {
        return this.queueManager.handleCollaboration(note, step);
    }
    async handleToolGeneration(note, step) {
        return this.queueManager.handleToolGeneration(note, step);
    }
    async handleKnowNote(note, step) {
        return this.queueManager.handleKnowNote(note, step);
    }
    async handleAnalytics(note, step) {
        return this.queueManager.handleAnalytics(note, step);
    }
    async handleFetchExternal(note, step) {
        return this.queueManager.handleFetchExternal(note, step);
    }
    async handleSummarize(note, step) {
        return this.queueManager.handleSummarize(note, step);
    }
    async handleGenerateCode(note, step) {
        return this.queueManager.handleGenerateCode(note, step);
    }
    async handleReflect(note, step) {
        return this.queueManager.handleReflect(note, step);
    }
    async executeStep(note, step, memoryMap) {
        return this.queueManager.executeStep(note, step, memoryMap);
    }
    async pruneMemory(note) {
        return this.queueManager.pruneMemory(note);
    }
    replacePlaceholders(input, memoryMap) {
        return this.queueManager.replacePlaceholders(input, memoryMap);
    }
    _processStepDependencies(dependencies, stepsById, readyQueue, stepId, note) {
        return this.queueManager._processStepDependencies(dependencies, stepsById, readyQueue, stepId, note);
    }
    async _updateNoteStatusPostExecution(note) {
        return this.queueManager._updateNoteStatusPostExecution(note);
    }
    async _runNoteTests(note) {
        return this.queueManager._runNoteTests(note);
    }
    async _finalizeNoteRun(note) {
        return this.queueManager._finalizeNoteRun(note);
    }
    _handleNoteError(note, error) {
        return this.queueManager._handleNoteError(note, error);
    }
    _handleToolNotFoundError(note, step) {
        return this.queueManager._handleToolNotFoundError(note, step);
    }
    _handleToolStepError(note, step, error) {
        return this.queueManager._handleToolStepError(note, step, error);
    }
    async handleFailure(note, error) {
        return this.queueManager.handleFailure(note, error);
    }
    shouldRetry(error) {
        return this.queueManager.shouldRetry(error);
    }
    async retryExecution(note) {
        return this.queueManager.retryExecution(note);
    }
    shouldRequestUnitTest(note, error) {
        return this.queueManager.shouldRequestUnitTest(note, error);
    }
    async requestUnitTest(note) {
        return this.queueManager.requestUnitTest(note);
    }
    updateAnalytics(note, event) {
        return this.queueManager.updateAnalytics(note, event);
    }
    queueExecution(note) {
        return this.queueManager.queueExecution(note);
    }
    async processQueue() {
        return this.queueManager.processQueue();
    }
    async optimizeSchedule() {
        return this.queueManager.optimizeSchedule();
    }
    async initScheduler() {
        return this.queueManager.initScheduler();
    }
    calculatePriority(note) {
        return this.queueManager.calculatePriority(note);
    }


    initialize() {
        this.state.log("Starting initialization...", 'info', {component: 'Server'});
        this.state.log("Loading tools...", 'info', {component: 'Server'});
        return this.state.tools.loadTools(CONFIG.TOOLS_BUILTIN_DIR)
            .then(loadedTools => {
                this.state.log(`Loaded ${loadedTools.length} tools.`, 'info', {
                    component: 'ToolLoader',
                    count: loadedTools.length
                });
                return this.loadNotesFromDB(); // Load notes after tools
            })
            .then(() => {
                this.state.llm.setApiKey('exampleApi', 'your-key-here');
                this.state.log("Server started successfully.", 'info', {component: 'Server'});
                this.start();
                this.queueManager.initScheduler(); // Initialize ExecutionQueueManager Scheduler
            })
            .catch(error => {
                this.state.log(`Tool loading failed during server initialization: ${error}`, 'error', {
                    component: 'ToolLoader',
                    error: error.message
                });
                throw error; // Re-throw to prevent server from starting if tools fail to load
            });
    async start() {
        const vite = await createViteServer({
            root: "client",
            plugins: [react()],
            server: { middlewareMode: true },
        });

        const httpServer = http.createServer((req, res) => vite.middlewares.handle(req, res));
        this.websocketServerManager.start(httpServer); // Start WebSocket server via WebSocketServerManager

        httpServer.listen(CONFIG.PORT, () => this.state.log(`Server running on localhost:${CONFIG.PORT}`, 'info', {
            component: 'Server',
            port: CONFIG.PORT
        }));
        setInterval(() => this.queueManager.processQueue(), CONFIG.QUEUE_INTERVAL);
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
            this.websocketServerManager.broadcastNoteUpdate(note); // Use WebSocketServerManager to broadcast
            const resolver = this.state.pendingWrites.get(note.id);
            if (resolver) resolver();
            this.state.pendingWrites.delete(note.id);
        });
    }
}

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];


export default NetentionServer;
