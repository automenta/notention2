export class Graph {
    constructor() {
        this.graph = new Map();
        this.edges = new Map();
    }

    addNote(note) {
        this.graph.set(note.id, note);
        this.edges.set(note.id, this.edges.get(note.id) || []);
    }

    removeNote(noteId) {
        const sourcesToUpdate = [];
        for (const [sourceId, edges] of this.edges) {
            const updatedEdges = edges.filter(edge => edge.target !== noteId);
            if (updatedEdges.length < edges.length) {
                this.edges.set(sourceId, updatedEdges);
                const sourceNote = this.graph.get(sourceId);
                if (sourceNote) {
                    sourceNote.references = updatedEdges.map(edge => edge.target);
                    sourcesToUpdate.push(sourceNote);
                }
            }
        }
        this.graph.delete(noteId);
        this.edges.delete(noteId);
        return sourcesToUpdate;
    }

    getNote(noteId) {
        return this.graph.get(noteId);
    }

    getNotes() {
        return Array.from(this.graph.values());
    }

    getSize() {
        return this.graph.size;
    }

    getReferences(noteId) {
        return (this.edges.get(noteId) || []).map(edge => edge.target);
    }

    addEdge(sourceId, targetId, relationship) {
        this.edges.set(sourceId, this.edges.get(sourceId) || []);
        this.edges.get(sourceId).push({target: targetId, rel: relationship});
    }

    removeEdge(sourceId, targetId) {
        if (this.edges.has(sourceId)) {
            this.edges.set(sourceId, this.edges.get(sourceId).filter(edge => edge.target !== targetId));
        }
    }
}
