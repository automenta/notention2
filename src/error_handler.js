export class ErrorHandler {
    constructor(serverState) {
        this.state = serverState;
    }

    handleNoteError(note, error) {
        this.state.log(`Error running note ${note.id}: ${error}`, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            errorType: 'NoteExecutionError',
            error: error.message
        });
        note.status = 'failed';
        note.error = error.message;
        this.state.writeNoteToDB(note);
        return note;
    }

    handleToolNotFoundError(note, step) {
        const errorMsg = `Tool ${step.tool} not found`;
        this.state.log(errorMsg, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            stepId: step.id,
            toolName: step.tool,
            errorType: 'ToolNotFoundError'
        });
        step.status = 'failed';
        step.error = errorMsg;
        note.status = 'failed';
        this.state.writeNoteToDB(note);
        return errorMsg;
    }

    handleToolStepError(note, step, error) {
        this.state.log(`Error executing tool ${step.tool} for note ${note.id}: ${error}`, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            stepId: step.id,
            toolName: step.tool,
            errorType: 'ToolExecutionError',
            error: error.message
        });
        step.status = 'failed';
        step.error = error.message;
        note.status = 'failed';
        this.state.writeNoteToDB(note);
        return `Tool execution failed: ${error.message}`;
    }
}
