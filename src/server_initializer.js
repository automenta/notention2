import react from '@vitejs/plugin-react';
import { createViteServer } from "vitest/node";
import * as http from "node:http";
import { CONFIG } from './config.js';

export class ServerInitializer {
    constructor(serverState, queueManager, websocketServerManager) {
        this.state = serverState;
        this.queueManager = queueManager;
        this.websocketServerManager = websocketServerManager;
    }

    async initialize() {
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
    }

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
}
