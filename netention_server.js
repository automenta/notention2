import { ServerState } from './server_state.js';
import { ExecutionQueue } from './execution_queue.js';
import { WebSocket } from './websocket.js';
import { ServerInitializer } from './server_initializer.js';
import { ServerCore } from './server_core.js';
import { NoteRunner } from './note_runner.js'; // Import NoteRunner

class NetentionServer {
    constructor() {
        this.state = new ServerState();
        this.queueManager = new ExecutionQueue(this.state);
        this.websocketManager = new WebSocket(this.state);
        this.core = new ServerCore(this.state, this.queueManager, this.websocketManager);
        this.initializer = new ServerInitializer(this.state, this.queueManager, this.websocketManager);
        this.noteRunner = new NoteRunner(this.state); // Instantiate NoteRunner
    }

    async initialize() {
        try {
            await this.initializer.initialize();
        } catch (error) {
            console.error("Server initialization failed:", error);
        }
    }

    async writeNoteToDB(note) {
        return this.core.writeNoteToDB(note);
    }

    async flushBatchedUpdates() {
        return this.core.flushBatchedUpdates();
    }

    async runNote(note) {
        return this.noteRunner.runNote(note); // Delegate to NoteRunner
    }

    replacePlaceholders(input, memoryMap) {
        return this.core.replacePlaceholders(input, memoryMap);
    }

    broadcastNoteUpdate(note) {
        return this.core.broadcastNoteUpdate(note);
    }
}

export default NetentionServer;
