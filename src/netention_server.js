import {ServerState} from './server_state_manager.js';
import {ExecutionQueue} from './execution_queue_manager.js'; // Import ExecutionQueue
import {WebSocketServerManager} from './websocket_handler.js'; // Import WebSocketServerManager
import {NetentionServerCore} from './netention_server_core.js'; // Import NetentionServerCore
import {NoteHandler} from './note_handler.js'; // Import NoteHandler
import {NoteRunner} from './note_runner.js'; // Import NoteRunner
import {ErrorHandler} from './error_handler.js'; // Import ErrorHandler
import react from '@vitejs/plugin-react';
import {createViteServer} from "vitest/node";
import * as http from "node:http";
import {CONFIG} from './config.js';
import {ToolLoader} from './tool_loader.js';
import {NoteLoader} from './note_loader.js';
import {NoteStepHandler} from './note_step_handler.js';
import {INITIAL_NOTES} from './initial_notes.js';


class NetentionServer {
    state;
    queueManager;
    websocketManager;
    errorHandler;
    noteStepHandler;
    noteRunner;
    noteHandler;
    toolLoader;
    noteLoader;
    serverCore; // Instance of NetentionServerCore

    constructor() {
        this.state = new ServerState();
        this.queueManager = new ExecutionQueue(this.state); // Instantiate ExecutionQueue
        this.websocketManager = new WebSocketServerManager(this.state, this.queueManager); // Instantiate WebSocketServerManager
        this.errorHandler = new ErrorHandler(this.state); // Instantiate ErrorHandler
        this.noteStepHandler = new NoteStepHandler(this.state, this.errorHandler);
        this.noteRunner = new NoteRunner(this.state, this.noteStepHandler, this.errorHandler, this); // Instantiate NoteRunner
        this.noteHandler = new NoteHandler(this.state, this.websocketManager, this.queueManager); // Instantiate NoteHandler
        this.toolLoader = new ToolLoader(this.state);
        this.noteLoader = new NoteLoader(this.state);
        this.serverCore = new NetentionServerCore( // Instantiate NetentionServerCore
            this.state,
            this.queueManager,
            this.websocketManager,
            this.errorHandler,
            this.noteStepHandler,
            this.noteRunner,
            this.noteHandler
        );
    }


    log(message, level = 'info', context = {}) {
        this.state.log(message, level, context);
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
            const loadedNotesCount = await this.noteLoader.loadNotes(INITIAL_NOTES);
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

        httpServer.listen(CONFIG.PORT, () => this.log(`Server running on localhost:${CONFIG.PORT}`, 'info', {
            component: 'Server',
            port: CONFIG.PORT
        }));
        setInterval(() => this.queueManager.processQueue(), CONFIG.QUEUE_INTERVAL);
    }



    async runNote(note) {
        return await this.noteRunner.runNote(note);
    }


    broadcastNoteUpdate(note) {
        this.websocketManager.broadcastNoteUpdate(note);
    }

    dispatchWebSocketMessage(parsedMessage) {
        return this.serverCore.dispatchWebSocketMessage(parsedMessage); // Delegate to serverCore
    }
}


export default NetentionServer;
