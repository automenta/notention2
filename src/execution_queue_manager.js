import { CONFIG } from './config.js';

export class ExecutionQueueManager {
    constructor(serverState) {
        this.state = serverState;
    }

    async initScheduler() {
        this.state.scheduler = setInterval(() => this.optimizeSchedule(), 5000);
    }

    async optimizeSchedule() {
        const notes = [...this.state.graph.getNotes()].filter(n => n.status === 'pending' || n.status === 'running');
        notes.sort((a, b) => this.calculatePriority(b) - this.calculatePriority(a));

        this.state.log(`Optimizing schedule, considering ${notes.length} notes.`, 'debug', {
            component: 'ExecutionQueueManager',
            notesCount: notes.length,
            pendingNotes: notes.map(n => ({ id: n.id, title: n.title, priority: this.calculatePriority(n) }))
        });

        for (const note of notes.slice(0, 10)) {
            if (!this.state.executionQueue.has(note.id)) this.queueExecution(note);
        }
    }

    calculatePriority(note) {
        const deadlineFactor = note.deadline ? (new Date(note.deadline) - Date.now()) / (1000 * 60 * 60) : 0;
        const usage = this.state.analytics.get(note.id)?.usage || 0;
        return (note.priority || 50) - (deadlineFactor < 0 ? 100 : deadlineFactor) + usage;
    }

    queueExecution(note) {
        this.state.log(`Queueing note ${note.id} for execution.`, 'debug', {
            component: 'ExecutionQueue',
            noteId: note.id
        });
        this.state.executionQueue.add(note.id);
    }

    async processQueue() {
        if (this.state.executionQueue.size === 0) return;
        const noteId = this.state.executionQueue.values().next().value;
        const note = this.state.graph.getNote(noteId);

        if (!note) {
            this.state.executionQueue.delete(noteId);
            return;
        }

        if (note.status !== 'pending' && note.status !== 'running' && note.status !== 'pendingUnitTesting') { // Include pendingUnitTesting
            this.state.executionQueue.delete(noteId);
            return;
        }

        try {
            await this.state.runNote(note); // Assuming runNote is in serverState or accessible
        } catch (error) {
            this.state.log(`Error processing note ${note.id} from queue: ${error}`, 'error', {
                component: 'ExecutionQueueManager',
                noteId: note.id,
                errorType: 'NoteProcessingError',
                errorMessage: error.message,
                errorStack: error.stack
            });
            this.state.executionQueue.delete(noteId);
        } finally {
            this.state.executionQueue.delete(noteId);
        }
    }

    updateAnalytics(note, event) {
        const stats = this.state.analytics.get(note.id) || {usage: 0, runtime: 0, lastStart: 0};
        if (event === 'start') stats.lastStart = Date.now();
        if (event === 'complete') {
            stats.usage++;
            stats.runtime += Date.now() - stats.lastStart;
        }
        this.state.analytics.set(note.id, stats);
    }
}
