import {ServerState} from './server_state_manager.js';
import {ExecutionQueue} from './execution_queue_manager.js';
import {WebSocketServerManager} from './websocket_manager.js';
import {NetentionServerCore} from './netention_server_core.js';
import {NoteHandler} from './note_handler.js';
import {NoteRunner} from './note_runner.js';
import {ErrorHandler} from './error_handler.js';
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
        this.queueManager = new ExecutionQueue(this.state);
        this.websocketManager = new WebSocketServerManager(this.state);
        this.errorHandler = new ErrorHandler(this.state);
        this.noteStepHandler = new NoteStepHandler(this.state, this.errorHandler);
        this.noteRunner = new NoteRunner(this.state, this.server, this.errorHandler);
        this.noteHandler = new NoteHandler(this.state);
        this.toolLoader = new ToolLoader(this.state);
        this.noteLoader = new NoteLoader(this.state);
        this.serverCore = new NetentionServerCore(
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
       // Note loading is now handled by NetentionServerCore
       // This method is intentionally left empty as the logic has moved
       this.log("Note loading delegated to NetentionServerCore.", 'info', {component: 'NoteLoader'});
        try {
            const loadedNotesCount = 0; // Indicate no notes loaded directly here
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
}


export default NetentionServer;
