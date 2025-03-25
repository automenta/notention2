import {WebSocket, WebSocketServer} from 'ws';
import {logWebSocketConnect, logWebSocketDisconnect} from './utils.js';

export class WebSocketServerManager {
    wss;
    messageQueue;

    constructor(serverState) {
        this.state = serverState;
        this.wss = null;
        this.messageQueue = []; // Initialize messageQueue here
    }

    start(httpServer) {
        this.wss = new WebSocketServer({server: httpServer});
        this.wss.on('connection', ws => this._handleConnection(ws));
    }

    _handleConnection(ws) {
        logWebSocketConnect(this.state);
        this._sendInitialData(ws);

        while (this.messageQueue.length) {
            const {client, message} = this.messageQueue.shift();
            if (!client || client.readyState === WebSocket.OPEN) {
                (client || ws).send(message);
            }
        }

        ws.on('message', async msg => {
            try {
                const parsedMessage = JSON.parse(msg);
                await this.state.serverCore.dispatchWebSocketMessage(parsedMessage); // Call dispatchWebSocketMessage on server core
            } catch (e) {
                this.state.log(`WebSocket message processing error: ${e}`, 'error', {
                    component: 'WebSocket',
                    errorType: 'MessageParsingError',
                    error: e.message
                });
            }
        });

        ws.on('close', () => logWebSocketDisconnect(this.state));
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
