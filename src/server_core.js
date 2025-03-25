export class ServerCore {
    constructor(state, queueManager, websocketManager, noteRunner, noteStepHandler, errorHandler) {
        this.state = state;
        this.queueManager = queueManager;
        this.websocketManager = websocketManager;
        this.noteRunner = noteRunner;
        this.noteStepHandler = noteStepHandler;
        this.errorHandler = errorHandler;
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
            this.websocketManager.broadcastNoteUpdate(note);
            const resolver = this.state.pendingWrites.get(note.id);
            if (resolver) resolver();
            this.state.pendingWrites.delete(note.id);
        });
    }

    // Expose queueManager methods via server core
    async runNote(note) {
        return this.noteRunner.runNote(note); // Use NoteRunner from constructor
    }


    // Expose state methods via server core
    replacePlaceholders(input, memoryMap) {
        return this.state.replacePlaceholders(input, memoryMap);
    }

    // Expose websocketManager methods via server core
    broadcastNoteUpdate(note) {
        return this.websocketManager.broadcastNoteUpdate(note);
    }
}
export class ServerCore {
    constructor(state, queueManager, websocketManager, noteRunner, noteStepHandler, errorHandler) {
        this.state = state;
        this.queueManager = queueManager;
        this.websocketManager = websocketManager;
        this.noteRunner = noteRunner;
        this.noteStepHandler = noteStepHandler;
        this.errorHandler = errorHandler;
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
            this.websocketManager.broadcastNoteUpdate(note);
            const resolver = this.state.pendingWrites.get(note.id);
            if (resolver) resolver();
            this.state.pendingWrites.delete(note.id);
        });
    }

    // Expose queueManager methods via server core
    async runNote(note) {
        return this.noteRunner.runNote(note); // Use NoteRunner from constructor
    }


    // Expose state methods via server core
    replacePlaceholders(input, memoryMap) {
        return this.state.replacePlaceholders(input, memoryMap);
    }

    // Expose websocketManager methods via server core
    broadcastNoteUpdate(note) {
        return this.websocketManager.broadcastNoteUpdate(note);
    }
}
