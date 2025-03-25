import {ServerState} from './server_state_manager.js';
import {ExecutionQueue} from './execution_queue_manager.js';
import {WebSocketServerManager} from './websocket_server.js';
import {NoteHandler} from './note_handler.js';
import {NoteRunner} from './note_runner.js';
import {ErrorHandler} from './error_handler.js';
import react from '@vitejs/plugin-react';
import {createViteServer} from "vitest/node";
import * as http from "node:http";
import {CONFIG} from './config.js';
import {ToolLoader} from './tool_loader.js';
import {NoteLoader} from './note_loader.js';
import {NoteStepHandler} from './note_step_handler.js';
import {INITIAL_NOTES} from './initial_notes.js';
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
            this.state.logger.log(`Unknown message type: ${parsedMessage.type}`, 'warn', {
                component: 'WebSocket',
                messageType: parsedMessage.type
            });
        }
    }

    async writeNoteToDB(note) {
        this.state.logger.log(`Writing note ${note.id} to DB.`, 'debug', {component: 'NoteWriter', noteId: note.id});
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
        });
        await Promise.all(Array.from(this.state.pendingWrites.values()).map(resolve => resolve()));
        this.state.pendingWrites.clear();
        await this.fileManager.saveNotesToDB(); // Ensure notes are saved to DB after batch update
    }
