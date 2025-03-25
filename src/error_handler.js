import {logNoteExecutionError, logNoteRetryQueued, logToolExecutionError, logToolNotFoundError} from './utils.js';
import {stepErrorTypes} from './note_step_handler.js';

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
            this.state.writeNoteToDB(note);
        }
        return note;
    }

    handleToolNotFoundError(note, step) {
        const errorMsg = `Tool ${step.tool} not found`;
        logToolNotFoundError(this.state, note.id, step.id, step.tool);
        step.status = 'failed';
        step.error = errorMsg;
        note.status = 'failed';
        this.state.writeNoteToDB(note);
        return errorMsg;
    }

    handleToolStepError(note, step, error) {
        logToolExecutionError(this.state, note.id, step.id, step.tool, error);
        step.status = 'failed';
        step.error = error.message;
        note.status = 'failed';
        this.state.writeNoteToDB(note);
        return `Tool execution failed: ${error.message}`;
    }

    shouldRetry(error) {
        return error.message.includes('timeout') || error.message.includes('rate limit');
    }

    retryExecution(note) {
        note.status = 'pending';
        this.state.writeNoteToDB(note);
        this.state.queueManager.queueExecution(note);
        logNoteRetryQueued(this.state, note.id);
    }


    shouldRequestUnitTest(note, error) {
        return stepErrorTypes.includes(error.errorType) || note.logic.some(step => step.tool === 'code_gen' && step.status === 'failed');
    }
}
