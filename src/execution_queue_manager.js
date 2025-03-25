import {logQueueProcessingError} from './utils.js';

export class ExecutionQueue {
    executionQueue;
    analytics;
    scheduler;

    constructor(serverState) {
        this.state = serverState;
        this.executionQueue = new Set(); // Initialize executionQueue here
        this.analytics = new Map(); // Initialize analytics here
    }

    initScheduler() {
        this.scheduler = setInterval(() => this.optimizeSchedule(), 5000);
    }

    async optimizeSchedule() {
        const notes = [...this.state.graph.getNotes()].filter(n => n.status === 'pending' || n.status === 'running');
        notes.sort((a, b) => this.calculatePriority(b) - this.calculatePriority(a));

        this.state.logger.log(`Optimizing schedule, considering ${notes.length} notes.`, 'debug', {
            component: 'ExecutionQueue',
            notesCount: notes.length,
            pendingNotes: notes.map(n => ({id: n.id, title: n.title, priority: this.calculatePriority(n)}))
        });

        for (const note of notes.slice(0, 10)) {
            if (!this.executionQueue.has(note.id)) this.queueExecution(note);
        }
    }

    calculatePriority(note) {
        const deadlineFactor = note.deadline ? (new Date(note.deadline) - Date.now()) / (1000 * 60 * 60) : 0;
        const usage = this.analytics.get(note.id)?.usage || 0;
        return (note.priority || 50) - (deadlineFactor < 0 ? 100 : deadlineFactor) + usage;
    }

    queueExecution(note) {
        this.state.logger.log(`Queueing note ${note.id} for execution.`, 'debug', {
            component: 'ExecutionQueue',
            noteId: note.id
        });
        this.executionQueue.add(note.id);
    }

    async processQueue() {
        if (this.executionQueue.size === 0) return;
        const noteId = this.executionQueue.values().next().value;
        const note = this.state.graph.getNote(noteId);

        if (!note) {
            this.executionQueue.delete(noteId);
            return;
        }

        if (note.status !== 'pending' && note.status !== 'running' && note.status !== 'pendingUnitTesting') {
            this.executionQueue.delete(noteId);
            return;
        }

        try {
            await this.state.runNote(note);
        } catch (error) {
            logQueueProcessingError(this.state, note.id, error);
            this.executionQueue.delete(noteId);
            // Basic retry for queue processing itself - re-queue the note if processing fails
            this.state.logger.warn(`Re-queueing note ${note.id} due to queue processing error.`, {
                component: 'ExecutionQueue',
                noteId: note.id,
                errorType: 'QueueProcessingError',
                errorMessage: error.message
            });
            this.queueExecution(note); // Re-queue the note
        } finally {
            this.executionQueue.delete(noteId);
        }
    }

    updateAnalytics(note, event) {
        const stats = this.analytics.get(note.id) || {usage: 0, runtime: 0, lastStart: 0};
        if (event === 'start') stats.lastStart = Date.now();
        if (event === 'complete') {
            stats.usage++;
            stats.runtime += Date.now() - stats.lastStart;
        }
        this.analytics.set(note.id, stats);
    }
}
