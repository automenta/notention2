import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG } from './config.js';
import { NoteHandler } from './note_handler.js'; // Import NoteHandler

export class WebSocketServerManager {
    noteHandler; // Declare NoteHandler

    constructor(serverState, executionQueue) {
        this.state = serverState;
        this.wss = null;
        this.noteHandler = new NoteHandler(serverState, this, executionQueue); // Instantiate NoteHandler
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
                await this._handleWebSocketMessage(parsedMessage, ws);
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


    async _handleWebSocketMessage(parsedMessage, ws) {
        switch (parsedMessage.type) {
            case 'createNote':
                await this.noteHandler.handleCreateNote(parsedMessage); // Delegate to NoteHandler
                break;
            case 'updateNote':
                await this.noteHandler.handleUpdateNote(parsedMessage); // Delegate to NoteHandler
                break;
            case 'deleteNote':
                await this.noteHandler.handleDeleteNote(parsedMessage); // Delegate to NoteHandler
                break;
            default:
                this.state.log('Unknown message type', 'warn', {
                    component: 'WebSocketServer',
                    messageType: parsedMessage.type
                });
        }
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
import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG } from './config.js';
import { NoteHandler } from './note_handler.js'; // Import NoteHandler

export class WebSocketServerManager {
    noteHandler; // Declare NoteHandler

    constructor(serverState, executionQueue) {
        this.state = serverState;
        this.wss = null;
        this.noteHandler = new NoteHandler(serverState, this, executionQueue); // Instantiate NoteHandler
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
                await this._handleWebSocketMessage(parsedMessage, ws);
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


    async _handleWebSocketMessage(parsedMessage, ws) {
        switch (parsedMessage.type) {
            case 'createNote':
                await this.noteHandler.handleCreateNote(parsedMessage); // Delegate to NoteHandler
                break;
            case 'updateNote':
                await this.noteHandler.handleUpdateNote(parsedMessage); // Delegate to NoteHandler
                break;
            case 'deleteNote':
                await this.noteHandler.handleDeleteNote(parsedMessage); // Delegate to NoteHandler
                break;
            default:
                this.state.log('Unknown message type', 'warn', {
                    component: 'WebSocketServer',
                    messageType: parsedMessage.type
                });
        }
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
