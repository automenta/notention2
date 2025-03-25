import {
    logNoteExecutionError,
    logNoteRetryQueued,
    logToolExecutionError,
    logToolNotFoundError
} from './utils.js';
import {
    ToolNotFoundError,
    ToolExecutionError,
    NoteExecutionError
} from './errors.js';

export class ErrorHandler {
    constructor(serverState) {
        this.state = serverState;
    }

    handleNoteError(note, error) {
        logNoteExecutionError(this.state, note.id, error);

        if (this.shouldRetry(error)) {
            this.retryExecution(note);
        } else if (this.shouldRequestUnitTest(note, error)) {
            this.requestUnitTest(note);
        } else {
            note.status = 'failed';
            this.state.serverCore.writeNoteToDB(note);
        }
        return note;
    }

    handleToolNotFoundError(note, step) {
        const error = new ToolNotFoundError(`Tool ${step.tool} not found`);
        logToolNotFoundError(this.state, note.id, step.id, step.tool);
        step.status = 'failed';
        step.error = error.message;
        this.state.serverCore.writeNoteToDB(note);
    }

    handleToolStepError(note, step, error) {
        const toolError = new ToolExecutionError(error.message);
        logToolExecutionError(this.state, note.id, step.id, step.tool, toolError);
        step.status = 'failed';
        step.error = toolError.message;
        this.state.serverCore.writeNoteToDB(note);
    }

    shouldRetry(error) {
        return error.message.includes('timeout') || error.message.includes('rate limit');
    }

    retryExecution(note) {
        note.status = 'pending';
        this.state.serverCore.writeNoteToDB(note);
        this.state.queueManager.queueExecution(note);
        logNoteRetryQueued(this.state, note.id);
    }

    shouldRequestUnitTest(note, error) {
        return note.logic.some(step => step.tool === 'code_gen' && step.status === 'failed');
    }
}
