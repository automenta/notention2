import { CONFIG } from './config.js';

class NetentionServerCore {

    state;
    queueManager;
    websocketManager;
    errorHandler;
    noteStepHandler;
    noteRunner;
    noteHandler;
    batchTimeout;

    constructor(state, queueManager, websocketManager, errorHandler, noteStepHandler, noteRunner, noteHandler) {
        this.state = state;
        this.queueManager = queueManager;
        this.websocketManager = websocketManager;
        this.errorHandler = errorHandler;
        this.noteStepHandler = noteStepHandler;
        this.noteRunner = noteRunner;
        this.noteHandler = noteHandler;
        this.batchTimeout = null;
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
    async writeNoteToDB(note) {
        this.state.log(`Writing note ${note.id} to DB.`, 'debug', {component: 'NoteWriter', noteId: note.id});
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
NetentionServerCore.prototype.dispatchWebSocketMessage = NetentionServerCore.prototype.dispatchWebSocketMessage;


export default NetentionServerCore;
