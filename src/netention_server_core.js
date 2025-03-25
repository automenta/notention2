import {CONFIG} from './config.js';
import {File} from './file.js';

class NetentionServerCore {

    state;
    queueManager;
    websocketManager;
    errorHandler;
    noteStepHandler;
    noteRunner;
    noteHandler;
    batchTimeout;
    toolLoader;
    messageHandlers;


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
        this.toolLoader = {loadTools: this.state.tools.loadTools.bind(this.state.tools)};
        this.messageHandlers = {
            'createNote': this.noteHandler.handleCreateNote.bind(this.noteHandler),
            'updateNote': this.noteHandler.handleUpdateNote.bind(this.noteHandler),
            'deleteNote': this.noteHandler.handleDeleteNote.bind(this.noteHandler),
        };
    }

    async loadNotesFromDB() {
        this.state.logger.log("Loading notes from DB...", 'info', {component: 'NoteLoader'});
        try {
            const loadedNotes = await this.fileManager.loadNotes();
            loadedNotes.forEach(note => this.state.graph.addNote(note));
            this.state.logger.log(`Loaded ${loadedNotes.length} notes from DB using File storage.`, 'info', {
                component: 'NoteLoader',
                count: loadedNotes.length
            });
        } catch (error) {
            this.state.logger.log(`Note loading failed during server initialization: ${error}`, 'error', {
                component: 'NoteLoader',
                error: error.message
            throw error; // Re-throw to prevent server from starting with no notes
        }
    }

    async flushBatchedUpdates() {
        const noteUpdates = Array.from(this.state.updateBatch).map(noteId => {
            return this.state.graph.getNote(noteId);
        });
        this.state.updateBatch.clear();
        this.batchTimeout = null;
        noteUpdates.forEach(note => {
            this.websocketManager.broadcastNoteUpdate(note);
        });
        await Promise.all(Array.from(this.state.pendingWrites.values()).map(resolve => resolve()));
        this.state.pendingWrites.clear();
        for (const note of noteUpdates) {
            await this.fileManager.saveNote(note); // Ensure notes are saved to DB after batch update
        }
    }
