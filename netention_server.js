import { ServerState } from './server_state_manager.js';
import { ExecutionQueue } from './execution_queue_manager.js';
import { WebSocketServerManager } from './websocket_handler.js';
import { ServerInitializer } from './server_initializer.js';
import { ServerCore } from './server_core.js';
import { NoteRunner } from './note_runner.js';
import { NoteHandler } from './note_handler.js';
import { NoteStepHandler } from './note_step_handler.js';
import { ErrorHandler } from './error_handler.js'; // Import ErrorHandler

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
        this.initializer = new ServerInitializer(this.state, this.queueManager, this.websocketManager, this.noteRunner);
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
