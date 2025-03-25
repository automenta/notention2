export class ServerCore {
    constructor(state, queueManager, websocketManager) {
        this.state = state;
        this.queueManager = queueManager;
        this.websocketManager = websocketManager;
    }

    async writeNoteToDB(note) {
        this.state.log(`Writing note ${note.id} to DB.`, 'debug', {component: 'NoteWriter', noteId: note.id});
        this.state.updateBatch.add(note.id);
        if (!this.state.batchTimeout) {
            this.state.batchTimeout = setTimeout(this.flushBatchedUpdates.bind(this), CONFIG.BATCH_INTERVAL);
        }
        return new Promise(resolve => this.state.pendingWrites.set(note.id, resolve));
    }

    async flushBatchedUpdates() {
        const noteUpdates = Array.from(this.state.updateBatch).map(noteId => {
            return this.state.graph.getNote(noteId);
        });
        this.state.updateBatch.clear();
        this.state.batchTimeout = null;
        noteUpdates.forEach(note => {
            this.websocketManager.broadcastNoteUpdate(note); // Use WebSocketManager to broadcast
            const resolver = this.state.pendingWrites.get(note.id);
            if (resolver) resolver();
            this.state.pendingWrites.delete(note.id);
        });
    }

    // Expose queueManager methods via server
    async runNote(note) {
        return this.queueManager.runNote(note);
    }

    // Expose state methods via server
    replacePlaceholders(input, memoryMap) {
        return this.state.replacePlaceholders(input, memoryMap);
    }

    // Expose websocketManager methods via server
    broadcastNoteUpdate(note) {
        return this.websocketManager.broadcastNoteUpdate(note);
    }
}
