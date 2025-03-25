import { ServerState } from './server_state_manager.js';
import { ExecutionQueue } from './execution_queue_manager.js';
import { WebSocketServerManager } from './websocket_handler.js';
import react from '@vitejs/plugin-react';
import {createViteServer} from "vitest/node";
import * as http from "node:http";
import {CONFIG} from './config.js';
import {ToolLoader} from './tool_loader.js';
import {NoteLoader} from './note_loader.js';
import { ServerCore } from './server_core.js'; // Keep ServerCore for now, we'll move its methods next
import { NoteRunner } from './note_runner.js';
import { NoteHandler } from './note_handler.js';
import { NoteStepHandler } from './note_step_handler.js';
import { ErrorHandler } from './error_handler.js';

class NetentionServer {
    constructor() {
        this.state = new ServerState();
        this.queueManager = new ExecutionQueue(this.state);
        this.websocketManager = new WebSocketServerManager(this.state, this.queueManager);
        this.errorHandler = new ErrorHandler(this.state); // Instantiate ErrorHandler
        this.noteStepHandler = new NoteStepHandler(this.state, this.errorHandler); // Pass ErrorHandler
        this.noteRunner = new NoteRunner(this.state, this.noteStepHandler, this.errorHandler); // Pass ErrorHandler
        this.noteHandler = new NoteHandler(this.state, this.websocketManager, this.queueManager);
        this.core = new ServerCore(this.state, this.queueManager, this.websocketManager, this.noteRunner, this.noteStepHandler, this.errorHandler);
        // this.initializer = new ServerInitializer(this.state, this.queueManager, this.websocketManager, this.noteRunner); // No longer needed
    }

    async initialize() {
        this.state.log("Starting initialization...", 'info', {component: 'Server'});
        await this._loadTools();
        await this._loadNotesFromDB();
        this.state.llm.setApiKey('exampleApi', 'your-key-here');
        this.state.log("Server started successfully.", 'info', {component: 'Server'});
        this._startServer();
        this.queueManager.initScheduler();
    }

    async _loadTools() {
        this.state.log("Loading tools...", 'info', {component: 'ToolLoader'});
        try {
            const loadedTools = await this.toolLoader.loadTools(CONFIG.TOOLS_BUILTIN_DIR); // Pass tools directory
            this.state.log(`Loaded ${loadedTools.length} tools.`, 'info', {
                component: 'ToolLoader',
                count: loadedTools.length
            });
        } catch (error) {
            this.state.log(`Tool loading failed during server initialization: ${error}`, 'error', {
                component: 'ToolLoader',
                error: error.message
            });
            throw error;
        }
    }

    async _loadNotesFromDB() {
        this.state.log("Loading notes from DB...", 'info', {component: 'NoteLoader'});
        try {
            const loadedNotesCount = await this.noteLoader.loadNotes();
            this.state.log(`Loaded ${loadedNotesCount} notes from DB.`, 'info', {
                component: 'NoteLoader',
                count: loadedNotesCount
            });
        } catch (error) {
            this.state.log(`Note loading failed during server initialization: ${error}`, 'error', {
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

        httpServer.listen(CONFIG.PORT, () => this.state.log(`Server running on localhost:${CONFIG.PORT}`, 'info', { component: 'Server', port: CONFIG.PORT }));
        setInterval(() => this.queueManager.processQueue(), CONFIG.QUEUE_INTERVAL);
    }



    async runNote(note) {
        return this.core.runNote(note); // Use runNote from ServerCore which uses NoteRunner
    }


    replacePlaceholders(input, memoryMap) {
        return this.core.replacePlaceholders(input, memoryMap);
    }

    broadcastNoteUpdate(note) {
        return this.core.broadcastNoteUpdate(note);
    }
}

export default NetentionServer;
