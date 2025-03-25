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
        this.serverCore.log(message, level, context);
    }

    timeoutPromise(promise, ms) {
        return this.serverCore.timeoutPromise(promise, ms);
    }

    async dispatchWebSocketMessage(parsedMessage) {
        await this.serverCore.dispatchWebSocketMessage(parsedMessage);
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
        return this.serverCore.flushBatchedUpdates();
    }


    async runNote(note) {
        return this.serverCore.runNote(note);
    }

    broadcastNoteUpdate(note) {
        return this.serverCore.broadcastNoteUpdate(note);
    }

    replacePlaceholders(input, memoryMap) {
        return this.serverCore.replacePlaceholders(input, memoryMap);
    }
}
NetentionServerCore.prototype.dispatchWebSocketMessage = NetentionServerCore.prototype.dispatchWebSocketMessage;


export default NetentionServerCore;
