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

    _handleFailure(note, error) {
        this.state.log(`Note ${note.id} execution failed: ${error}`, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            errorType: 'NoteExecutionError'
        });

        if (this.shouldRetry(error)) {
            this.retryExecution(note);
        } else if (this.shouldRequestUnitTest(note, error)) {
            this.requestUnitTest(note);
        } else {
            note.status = 'failed';
            this.state.writeNoteToDB(note);
        }
    }


    shouldRetry(error) {
        return error.message.includes('timeout') || error.message.includes('rate limit');
    }

    retryExecution(note) {
        note.status = 'pending';
        this.state.writeNoteToDB(note);
        this.state.queueExecution(note);
        this.state.log(`Note ${note.id} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: note.id});
    }


    shouldRequestUnitTest(note, error) {
        const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError']; // Assuming stepErrorTypes is defined elsewhere or needs to be passed
        return stepErrorTypes.includes(error.errorType) || note.logic.some(step => step.tool === 'code_gen' && step.status === 'failed');
    }


    async requestUnitTest(note) {
        if (!note.tests) note.tests = [];
        const testId = crypto.randomUUID();
        note.tests.push(testId);
        note.status = 'pendingUnitTesting';
        await this.state.writeNoteToDB(note);


        const testNote = {
            id: testId,
            title: `Unit Test for ${note.title}`,
            content: {
                type: 'test',
                targetNoteId: note.id
            },
            status: 'pending',
            priority: 60,
            createdAt: new Date().toISOString(),
            references: [note.id]
        };
        this.state.graph.addNote(testNote);
        await this.state.writeNoteToDB(testNote);
        this.state.queueExecution(testNote);
        this.state.log(`Unit test requested for Note ${note.id}, test Note ${testId} created.`, 'info', {
            component: 'NoteRunner',
            noteId: note.id,
            testNoteId: testId
        });
    }
}
