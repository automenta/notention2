import crypto from 'crypto';

export class NoteHandler {
    constructor(serverState) {
        this.state = serverState;
    }

    async handleCreateNote(parsedMessage) {
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
        await this.state.serverCore.writeNoteToDB(newNote);
        this.state.queueManager.queueExecution(newNote);
        this.state.websocketManager.broadcastNotesUpdate();
    }

    async handleUpdateNote(parsedMessage) {
        const updatedNote = parsedMessage;
        const existingNote = this.state.graph.getNote(updatedNote.id);
        if (existingNote) {
            Object.assign(existingNote, updatedNote);
            existingNote.updatedAt = new Date().toISOString();
            await this.state.serverCore.writeNoteToDB(existingNote);
            this.state.websocketManager.broadcastNotesUpdate();
        }
    }

    async handleDeleteNote(parsedMessage) {
        const noteIdToDelete = parsedMessage.id;
        this.state.graph.removeNote(noteIdToDelete);
        await this.state.graph.removeReferences(noteIdToDelete);
        await this.state.serverCore.writeNoteToDB({id: noteIdToDelete}); //still write to trigger update
        this.state.websocketManager.broadcastNotesUpdate();
    }
}
