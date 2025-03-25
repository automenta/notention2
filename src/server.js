


class NetentionServer {
    constructor() {
        this.state = new ServerState();
        this.queueManager = new ExecutionQueueManager(this.state);
        this.websocketServerManager = new WebSocketServerManager(this.state); // Instantiate WebSocketServerManager

import { ServerState } from './server_state.js';
import { ExecutionQueueManager } from './execution_queue_manager.js';
import { WebSocketServerManager } from './websocket_server.js';
import { ServerInitializer } from './server_initializer.js';

class NetentionServer {
    constructor() {
        this.state = new ServerState();
        this.queueManager = new ExecutionQueueManager(this.state);
        this.websocketServerManager = new WebSocketServerManager(this.state);
        this.initializer = new ServerInitializer(this.state, this.queueManager, this.websocketServerManager);
    }

    async initialize() {
        try {
            await this.initializer.initialize();
        } catch (error) {
            console.error("Server initialization failed:", error);
            // Handle initialization failure as needed
        }
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

    // Expose queueManager methods via server
    async runNote(note) {
        return this.queueManager.runNote(note);
    }

    // Expose state methods via server
    replacePlaceholders(input, memoryMap) {
        return this.state.replacePlaceholders(input, memoryMap);
    }

    // Expose websocketServerManager methods via server
    broadcastNoteUpdate(note) {
        return this.websocketServerManager.broadcastNoteUpdate(note);
    }
}

export default NetentionServer;
