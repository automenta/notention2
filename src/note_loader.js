export class NoteLoader {
    constructor(state, fileManager) {
        this.state = state;
        this.fileManager = fileManager;
    }

    async loadNotesFromDB() {
        this.state.logger.log("Loading notes from DB...", 'info', {component: 'NoteLoader'});
        try {
            const loadedNotes = await this.fileManager.loadNotes();
            loadedNotes.forEach(note => this.state.graph.addNote(note));
            this.state.logger.log(`Loaded ${loadedNotes.length} notes from DB using File storage.`, 'info', {
                component: 'NoteLoader',
                count: loadedNotes.length
            });
        } catch (error) {
            this.state.logger.log(`Note loading failed during server initialization: ${error}`, 'error', {
                component: 'NoteLoader',
                error: error.message
            });
            throw error; // Re-throw to prevent server from starting with no notes
        }
    }
}
