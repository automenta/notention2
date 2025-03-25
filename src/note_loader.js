export class NoteLoader {
    constructor(serverState) {
        this.state = serverState;
    }

    async loadNotes(initialNotes) {
        initialNotes.forEach(note => this.state.graph.addNote(note));
        return this.state.graph.getNotes().length;
    }
}
export class NoteLoader {
    constructor(serverState) {
        this.state = serverState;
    }

    async loadNotes(initialNotes) {
        initialNotes.forEach(note => this.state.graph.addNote(note));
        return this.state.graph.getNotes().length;
    }
}
