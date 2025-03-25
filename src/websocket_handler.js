import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG } from './config.js';
import crypto from 'crypto';

export class WebSocketServerManager {
    constructor(serverState) {
        this.state = serverState;
        this.wss = null;
    }

    start(httpServer) {
        this.wss = new WebSocketServer({ server: httpServer });
        this.wss.on('connection', ws => this._handleConnection(ws));
    }

    _handleConnection(ws) {
        this.state.log('Client connected', 'info', { component: 'WebSocketServer' });
        this._sendInitialData(ws);

        while (this.state.messageQueue.length) {
            const { client, message } = this.state.messageQueue.shift();
            if (!client || client.readyState === WebSocket.OPEN) {
                (client || ws).send(message);
            }
        }

        ws.on('message', async msg => {
            try {
                const parsedMessage = JSON.parse(msg);
                await this._handleWebSocketMessage(parsedMessage, ws); // Pass WebSocket instance
            } catch (e) {
                this.state.log(`WebSocket message processing error: ${e}`, 'error', {
                    component: 'WebSocketServer',
                    errorType: 'MessageParsingError',
                    error: e.message
                });
            }
        });

        ws.on('close', () => this.state.log('Client disconnected', 'info', { component: 'WebSocketServer' }));
    }

    _sendInitialData(ws) {
        ws.send(JSON.stringify({ type: 'notes', data: this.state.graph.getNotes() }));
        const availableToolsData = this.state.tools.getTools().map(tool => ({
            name: tool.name,
            description: tool.description,
            schema: tool.schema
        }));
        ws.send(JSON.stringify({ type: 'tools', data: availableToolsData }));
    }


    async _handleWebSocketMessage(parsedMessage, ws) { // Receive WebSocket instance
        switch (parsedMessage.type) {
            case 'createNote':
                await this._handleCreateNote(parsedMessage);
                break;
            case 'updateNote':
                await this._handleUpdateNote(parsedMessage);
                break;
            case 'deleteNote':
                await this._handleDeleteNote(parsedMessage);
                break;
            default:
                this.state.log('Unknown message type', 'warn', {
                    component: 'WebSocketServer',
                    messageType: parsedMessage.type
                });
        }
    }


    async _handleCreateNote(parsedMessage) {
        const newNote = {
            id: crypto.randomUUID(),
            title: parsedMessage.title || 'New Note',
            content: '',
            status: 'pending',
            logic: [],
            memory: [],
            createdAt: new Date().toISOString(),
        };
        this.state.graph.addNote(newNote);
        await this.state.writeNoteToDB(newNote);
        this.state.queueExecution(newNote);
        this.broadcastNotesUpdate(); // Broadcast note list update
    }

    async _handleUpdateNote(parsedMessage) {
        const updatedNote = parsedMessage;
        const existingNote = this.state.graph.getNote(updatedNote.id);
        if (existingNote) {
            Object.assign(existingNote, updatedNote);
            existingNote.updatedAt = new Date().toISOString();
            await this.state.writeNoteToDB(existingNote);
            this.broadcastNotesUpdate(); // Broadcast note list update
        }
    }

    async _handleDeleteNote(parsedMessage) {
        const noteIdToDelete = parsedMessage.id;
        this.state.graph.removeNote(noteIdToDelete);
        await this.state.graph.removeReferences(noteIdToDelete);
        await this.state.writeNoteToDB({ id: noteIdToDelete }); //still write to trigger update
        this.broadcastNotesUpdate(); // Broadcast note list update
    }


    broadcastNotesUpdate() {
        this.broadcast({ type: 'notes', data: this.state.graph.getNotes() });
    }

    broadcastNoteUpdate(note) {
        this.broadcast({ type: 'noteUpdate', data: note });
    }


    broadcast(message) {
        if (!this.wss) return;
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}
