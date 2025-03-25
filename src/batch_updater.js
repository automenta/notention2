export class BatchUpdater {
    constructor(state, websocketManager, fileManager) {
        this.state = state;
        this.websocketManager = websocketManager;
        this.fileManager = fileManager;
        this.batchTimeout = null;
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
        for (const note of noteUpdates) {
            await this.fileManager.saveNote(note); // Ensure notes are saved to DB after batch update
        }
    }
}
