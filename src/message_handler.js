export class MessageHandler {
    constructor(noteHandler) {
        this.noteHandler = noteHandler;
    }

    handleMessage(type, data) {
        switch (type) {
            case 'createNote':
                return this.noteHandler.handleCreateNote(data);
            case 'updateNote':
                return this.noteHandler.handleUpdateNote(data);
            case 'deleteNote':
                return this.noteHandler.handleDeleteNote(data);
            default:
                console.warn(`Unknown message type: ${type}`);
                return null;
        }
    }
}
