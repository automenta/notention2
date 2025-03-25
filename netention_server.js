import { ServerState } from './server_state_manager.js';
import { ExecutionQueue } from './execution_queue_manager.js';
import { WebSocketServerManager } from './websocket_handler.js';
import react from '@vitejs/plugin-react';
import {createViteServer} from "vitest/node";
import * as http from "node:http";
import {CONFIG} from './config.js';
import {ToolLoader} from './tool_loader.js';
import {NoteLoader} from './note_loader.js';
import { NoteRunner } from './note_runner.js';
import { NoteHandler } from './note_handler.js';
import { NoteStepHandler } from './note_step_handler.js';
import { ServerState } from './server_state_manager.js';
import { ExecutionQueue } from './execution_queue_manager.js';
import { WebSocketServerManager } from './websocket_handler.js';
import { ErrorHandler } from './error_handler.js';

class NetentionServer {
    state;
    queueManager;
    websocketManager;
    errorHandler;
    noteStepHandler;
    noteRunner;
    noteHandler;
    batchTimeout;

    constructor() {
        this.state = new ServerState();
        this.queueManager = new ExecutionQueue(this.state);
        this.websocketManager = new WebSocketServerManager(this.state, this.queueManager);
        this.errorHandler = new ErrorHandler(this.state);
        this.noteStepHandler = new NoteStepHandler(this.state, this.errorHandler);
        this.noteRunner = new NoteRunner(this.state, this.noteStepHandler, this.errorHandler, this);
        this.noteHandler = new NoteHandler(this.state, this.websocketManager, this.queueManager);
        this.batchTimeout = null; // Initialize batchTimeout here
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

    async dispatchWebSocketMessage(parsedMessage) {
        switch (parsedMessage.type) {
            case 'createNote':
                await this.noteHandler.handleCreateNote(parsedMessage);
                break;
            case 'updateNote':
                await this.noteHandler.handleUpdateNote(parsedMessage);
                break;
            case 'deleteNote':
                await this.noteHandler.handleDeleteNote(parsedMessage);
                break;
            default:
                this.state.log('Unknown message type', 'warn', {
                    component: 'WebSocket',
                    messageType: parsedMessage.type
                });
        }
    }

    async initialize() {
        this.log("Starting initialization...", 'info', {component: 'Server'});
        await this._loadTools();
        await this._loadNotesFromDB();
        this.state.llm.setApiKey('exampleApi', 'your-key-here');
        this.log("Server started successfully.", 'info', {component: 'Server'});
        this._startServer();
        this.queueManager.initScheduler();
    }

    async _loadTools() {
        this.log("Loading tools...", 'info', {component: 'ToolLoader'});
        try {
            const loadedTools = await this.toolLoader.loadTools(CONFIG.TOOLS_BUILTIN_DIR);
            this.log(`Loaded ${loadedTools.length} tools.`, 'info', {
                component: 'ToolLoader',
                count: loadedTools.length
            });
        } catch (error) {
            this.log(`Tool loading failed during server initialization: ${error}`, 'error', {
                component: 'ToolLoader',
                error: error.message
            });
            throw error;
        }
    }

    async _loadNotesFromDB() {
        this.log("Loading notes from DB...", 'info', {component: 'NoteLoader'});
        try {
            const loadedNotesCount = await this.noteLoader.loadNotes();
            this.log(`Loaded ${loadedNotesCount} notes from DB.`, 'info', {
                component: 'NoteLoader',
                count: loadedNotesCount
            });
        } catch (error) {
            this.log(`Note loading failed during server initialization: ${error}`, 'error', {
                component: 'NoteLoader',
                error: error.message
            });
            throw error;
        }
    }


    async _startServer() {
        const vite = await createViteServer({
            root: "client",
            plugins: [react()],
            server: {middlewareMode: true},
        });

        const httpServer = http.createServer((req, res) => vite.middlewares.handle(req, res));
        this.websocketManager.start(httpServer);

        httpServer.listen(CONFIG.PORT, () => this.log(`Server running on localhost:${CONFIG.PORT}`, 'info', { component: 'Server', port: CONFIG.PORT }));
        setInterval(() => this.queueManager.processQueue(), CONFIG.QUEUE_INTERVAL);
    }


    async writeNoteToDB(note) {
        this.log(`Writing note ${note.id} to DB.`, 'debug', {component: 'NoteWriter', noteId: note.id});
        this.state.updateBatch.add(note.id);
        if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(this.flushBatchedUpdates.bind(this), CONFIG.BATCH_INTERVAL);
        }
        return new Promise(resolve => this.state.pendingWrites.set(note.id, resolve));
    }

    async flushBatchedUpdates() {
        const noteUpdates = Array.from(this.state.updateBatch).map(noteId => {
            return this.state.graph.getNote(noteId);
        });
        this.state.updateBatch.clear();
        this.batchTimeout = null;
        noteUpdates.forEach(note => {
            this.websocketManager.broadcastNoteUpdate(note);
            const resolver = this.state.pendingWrites.get(note.id);
            if (resolver) resolver();
            this.state.pendingWrites.delete(note.id);
        });
    }


    async runNote(note) {
        return this.noteRunner.runNote(note);
    }

    broadcastNoteUpdate(note) {
        return this.websocketManager.broadcastNoteUpdate(note);
    }

    replacePlaceholders(input, memoryMap) {
        if (typeof input === 'string') {
            return input.replace(/\${(\w+)}/g, (_, stepId) => memoryMap.get(stepId) || '');
        }
        return input;
    }
}
NetentionServer.prototype.dispatchWebSocketMessage = NetentionServer.prototype.dispatchWebSocketMessage;

export default NetentionServer;
