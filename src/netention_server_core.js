import {CONFIG} from './config.js';
import {File} from './file.js';
import {NoteLoader} from './note_loader.js';
import {BatchUpdater} from './batch_updater.js';

class NetentionServerCore {

    state;
    queueManager;
    websocketManager;
    errorHandler;
    noteStepHandler;
    noteRunner;
    noteHandler;
    toolLoader;
    messageHandlers;
    noteLoader;
    batchTimeout;
    batchUpdater;


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
        this.noteLoader = new NoteLoader(this.state, this.fileManager);
        this.batchUpdater = new BatchUpdater(this.state, this.websocketManager, this.fileManager);
    }

    async loadNotesFromDB() {
        await this.noteLoader.loadNotesFromDB();
    }

    async flushBatchedUpdates() {
        await this.batchUpdater.flushBatchedUpdates();
    }
