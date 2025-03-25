import {CONFIG} from './config.js';

class NetentionServerCore {

    state;
    queueManager;
    websocketManager;
    errorHandler;
    noteStepHandler;
    noteRunner;
    noteHandler;
    batchTimeout;
    NetentionServerCore
    prototype
    dispatchWebSocketMessage = NetentionServerCore.prototype.dispatchWebSocketMessage;
    export
    default
    NetentionServerCore;

    constructor(state, queueManager, websocketManager, errorHandler, noteStepHandler, noteRunner, noteHandler) {
        this.state = state;
        this.queueManager = queueManager;
        this.websocketManager = websocketManager;
        this.errorHandler = errorHandler;
        this.noteStepHandler = noteStepHandler;
        this.noteRunner = noteRunner;
        this.noteHandler = noteHandler;
        this.batchTimeout = null;
        this.loadNotesFromDB(); // Load notes from DB on initialization
    }

    log(message, level = 'info', context = {}) {
        this.state.log(message, level, context);
    }


    async dispatchWebSocketMessage(parsedMessage) {
        if (parsedMessage.type === 'createNote') {
            await this.noteHandler.handleCreateNote(parsedMessage);
        } else if (parsedMessage.type === 'updateNote') {
            await this.noteHandler.handleUpdateNote(parsedMessage);
        } else if (parsedMessage.type === 'deleteNote') {
            await this.noteHandler.handleDeleteNote(parsedMessage);
        } else if (parsedMessage.type === 'createEdge') {
            await this.noteHandler.handleCreateEdge(parsedMessage);
        } else {
            this.state.log(`Unknown message type: ${parsedMessage.type}`, 'warn', {
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
        return this.flushBatchedUpdates_impl();
    }

    async flushBatchedUpdates_impl() {


        async
        runNote(note)
        {
            return this.runNote_impl(note);
        }

        async
        runNote_impl(note)
        {
        }

        broadcastNoteUpdate(note)
        {
            return this.broadcastNoteUpdate_impl(note);
        }

        broadcastNoteUpdate_impl(note)
        {
        }

        replacePlaceholders(input, memoryMap)
        {
            if (typeof input === 'string') {
                return input.replace(/\${(\w+)}/g, (_, stepId) => memoryMap.get(stepId) || '');
            }
            return input;
        }
    }
