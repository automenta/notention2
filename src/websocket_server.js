import {WebSocket, WebSocketServer} from 'ws';
import crypto from 'crypto';

export class WebSocketServerManager {
    constructor(serverState) {
        this.state = serverState;
        this.wss = null;
    }

    start(httpServer) {
        this.wss = new WebSocketServer({server: httpServer});
        this.wss.on('connection', ws => this._handleConnection(ws));
    }

    _handleConnection(ws) {
        this.state.log('Client connected', 'info', {component: 'WebSocket'});
        this._sendInitialData(ws);

        while (this.state.messageQueue.length) {
            const {client, message} = this.state.messageQueue.shift();
            if (!client || client.readyState === WebSocket.OPEN) {
                (client || ws).send(message);
            }
        }

        ws.on('message', async msg => {
            try {
                const parsedMessage = JSON.parse(msg);
                await this._dispatchMessage(parsedMessage, ws); // Use dispatchMessage
            } catch (e) {
                this.state.log(`WebSocket message processing error: ${e}`, 'error', {
                    component: 'WebSocket',
                    errorType: 'MessageParsingError',
                    error: e.message
                });
            }
        });

        ws.on('close', () => this.state.log('Client disconnected', 'info', {component: 'WebSocket'}));
    }

    _sendInitialData(ws) {
        ws.send(JSON.stringify({type: 'notes', data: this.state.graph.getNotes()}));
        const availableToolsData = this.state.tools.getTools().map(tool => ({
            name: tool.name,
            description: tool.description,
            schema: tool.schema
        }));
        ws.send(JSON.stringify({type: 'tools', data: availableToolsData}));
    }


    async _dispatchMessage(parsedMessage, ws) {
        switch (parsedMessage.type) {
            case 'createNote':
                await this.state.noteHandler.handleCreateNote(parsedMessage);
                break;
            case 'updateNote':
                await this.state.noteHandler.handleUpdateNote(parsedMessage);
                break;
            case 'deleteNote':
                await this.state.noteHandler.handleDeleteNote(parsedMessage);
                break;
            default:
                this.state.log('Unknown message type', 'warn', {
                    component: 'WebSocket',
                    messageType: parsedMessage.type
                });
        }
    }

    broadcastNotesUpdate() {
        this.broadcast({type: 'notes', data: this.state.graph.getNotes()});
    }

    broadcastNoteUpdate(note) {
        this.broadcast({type: 'noteUpdate', data: note});
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
