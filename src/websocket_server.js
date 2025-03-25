import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG } from './config.js';

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
        ws.send(JSON.stringify({ type: 'notes', data: this.state.graph.getNotes() }));
        const availableToolsData = this.state.tools.getTools().map(tool => ({
            name: tool.name,
            description: tool.description,
            schema: tool.schema
        }));
        ws.send(JSON.stringify({ type: 'tools', data: availableToolsData }));

        while (this.state.messageQueue.length) {
            const { client, message } = this.state.messageQueue.shift();
            if (!client || client.readyState === WebSocket.OPEN) {
                (client || ws).send(message);
            }
        }

        ws.on('message', async msg => {
            try {
                const parsedMessage = JSON.parse(msg);
                await this._handleWebSocketMessage(parsedMessage);
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


    async _handleWebSocketMessage(parsedMessage) {
        switch (parsedMessage.type) {
            case 'createNote': {
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
                this.broadcastNotesUpdate();
                break;
            }
            case 'updateNote': {
                const updatedNote = parsedMessage;
                const existingNote = this.state.graph.getNote(updatedNote.id);
                if (existingNote) {
                    Object.assign(existingNote, updatedNote);
                    existingNote.updatedAt = new Date().toISOString();
                    await this.state.writeNoteToDB(existingNote);
                    this.broadcastNotesUpdate();
                }
                break;
            }
            case 'deleteNote': {
                const noteIdToDelete = parsedMessage.id;
                this.state.graph.removeNote(noteIdToDelete);
                await this.state.graph.removeReferences(noteIdToDelete);
                await this.state.writeNoteToDB({ id: noteIdToDelete }); //still write to trigger update
                this.broadcastNotesUpdate();
                break;
            }
            default:
                this.state.log('Unknown message type', 'warn', {
                    component: 'WebSocketServer',
                    messageType: parsedMessage.type
                });
        }
    }
}
