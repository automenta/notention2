export class GraphEngine {
    constructor() {
        this.graph = new Map();
    }

    addNote(note) {
        this.graph.set(note.id, note);
    }

    removeNote(noteId) {
        this.graph.delete(noteId);
    }

    getNote(noteId) {
        return this.graph.get(noteId);
    }

    addEdge(sourceId, targetId, relationship) {
        const source = this.getNote(sourceId);
        if (source) {
            source.references.push({ target: targetId, rel: relationship });
        }
    }

    removeEdge(sourceId, targetId) {
        const source = this.getNote(sourceId);
        if (source) {
            source.references = source.references.filter(ref => ref.target !== targetId);
        }
    }
}
