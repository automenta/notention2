import react from '@vitejs/plugin-react';
import { createViteServer } from "vitest/node";
import * as http from "node:http";
import { CONFIG, INITIAL_NOTES } from './config.js';
import { ToolLoader } from './tool_loader_manager.js';
import { NoteLoader } from './note_loader.js';

export class ServerInitializer {
    constructor(serverState, queueManager, websocketManager) {
        this.state = serverState;
        this.queueManager = queueManager;
        this.websocketManager = websocketManager;
        this.toolLoader = new ToolLoader(serverState); // Use ToolLoader from new module
        this.noteLoader = new NoteLoader(serverState);
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
        this.state.log("Loading tools...", 'info', {component: 'Server'});
        try {
            const loadedTools = await this.toolLoader.loadTools();
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
            const loadedNotesCount = await this.noteLoader.loadNotes(INITIAL_NOTES);
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
            server: { middlewareMode: true },
        });

        const httpServer = http.createServer((req, res) => vite.middlewares.handle(req, res));
        this.websocketManager.start(httpServer);

        httpServer.listen(CONFIG.PORT, () => this.state.log(`Server running on localhost:${CONFIG.PORT}`, 'info', {
            component: 'Server',
            port: CONFIG.PORT
        }));
        setInterval(() => this.queueManager.processQueue(), CONFIG.QUEUE_INTERVAL);
    }
}
import react from '@vitejs/plugin-react';
import { createViteServer } from "vitest/node";
import * as http from "node:http";
import { CONFIG, INITIAL_NOTES } from './config.js';
import { ToolLoader } from './tool_loader_manager.js';
import { NoteLoader } from './note_loader.js';

export class ServerInitializer {
    constructor(serverState, queueManager, websocketManager) {
        this.state = serverState;
        this.queueManager = queueManager;
        this.websocketManager = websocketManager;
        this.toolLoader = new ToolLoader(serverState); // Use ToolLoader from new module
        this.noteLoader = new NoteLoader(serverState);
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
        this.state.log("Loading tools...", 'info', {component: 'Server'});
        try {
            const loadedTools = await this.toolLoader.loadTools();
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
            const loadedNotesCount = await this.noteLoader.loadNotes(INITIAL_NOTES);
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
            server: { middlewareMode: true },
        });

        const httpServer = http.createServer((req, res) => vite.middlewares.handle(req, res));
        this.websocketManager.start(httpServer);

        httpServer.listen(CONFIG.PORT, () => this.state.log(`Server running on localhost:${CONFIG.PORT}`, 'info', {
            component: 'Server',
            port: CONFIG.PORT
        }));
        setInterval(() => this.queueManager.processQueue(), CONFIG.QUEUE_INTERVAL);
    }
}
