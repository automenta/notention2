import {CONFIG} from './config.js';
import { File } from './file.js';

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
        this.fileManager = new File(CONFIG.DB_PATH); // Instantiate File manager
        this.loadNotesFromDB(); // Load notes from DB on initialization
    }

    log(message, level = 'info', context = {}) {
        this.state.log(message, level, context);
    }

    async loadNotesFromDB() {
        this.log("Loading notes from DB...", 'info', {component: 'NoteLoader'});
        try {
            const loadedNotes = await this.fileManager.loadNotes();
            loadedNotes.forEach(note => this.state.graph.addNote(note));
            this.log(`Loaded ${loadedNotes.length} notes from DB using File storage.`, 'info', {
                component: 'NoteLoader',
                count: loadedNotes.length
            });
        } catch (error) {
            this.state.log(`Note loading failed during server initialization: ${error}`, 'error', {
                component: 'NoteLoader',
                error: error.message
            });
            throw error; // Re-throw to prevent server from starting with no notes
        }
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
        const noteUpdates = Array.from(this.state.updateBatch).map(noteId => {
            return this.state.graph.getNote(noteId);
        });
        this.state.updateBatch.clear();
        this.batchTimeout = null;
        noteUpdates.forEach(note => {
            this.websocketManager.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({type: 'noteUpdate', data: note}));
                }
            });
        });
        await Promise.all(Array.from(this.state.pendingWrites.values()).map(resolve => resolve()));
        this.state.pendingWrites.clear();
        await this.fileManager.saveNotesToDB(); // Ensure notes are saved to DB after batch update
    }
