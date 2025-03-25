export function timeoutPromise(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
}

export function replacePlaceholders(input, memoryMap) {
    if (typeof input === 'string') {
        return input.replace(/\${(\w+)}/g, (_, stepId) => memoryMap.get(stepId) || '');
    }
    return input;
}

export function logToolStart(state, noteId, stepId, toolName) {
    state.logger.log(`Executing step ${stepId} of note ${noteId} with tool ${toolName}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        toolName: toolName
    });
}

export function logNoteStart(state, noteId) {
    state.logger.log(`Starting execution of note ${noteId}`, 'info', {
        component: 'NoteRunner',
        noteId: noteId
    });
}

export function logNoteFinalize(state, noteId, status) {
    state.logger.log(`Note ${noteId} execution finalized with status: ${status}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        status: status
    });
}

export function logQueueProcessingError(state, noteId, error) {
    state.logger.log(`Error processing note ${noteId} from queue: ${error}`, 'error', {
        component: 'ExecutionQueue',
        noteId: noteId,
        errorType: 'NoteProcessingError',
        error: error.message,
        errorStack: error.stack
    });
}

export function logNoteExecutionError(state, noteId, error) {
    state.logger.log(`Error running note ${noteId}: ${error}`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        errorType: 'NoteExecutionError',
        error: error.message
    });
}

export function logToolNotFoundError(state, noteId, stepId, toolName) {
    state.logger.log(`Tool ${toolName} not found`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        toolName: toolName,
        errorType: 'ToolNotFoundError'
    });
}

export function logToolExecutionError(state, noteId, stepId, toolName, error) {
    state.logger.log(`Error executing tool ${toolName} for note ${noteId}: ${error}`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        toolName: toolName,
        errorType: 'ToolExecutionError',
        error: error.message
    });
}

export function logNoteRetryQueued(state, noteId) {
    state.logger.log(`Note ${noteId} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: noteId});
}

export function logUnitTestRequestQueued(state, noteId, testNoteId) {
    state.logger.log(`Unit test requested for Note ${noteId}, test Note ${testNoteId} created.`, 'info', {
        component: 'NoteRunner',
        noteId: noteId,
        testNoteId: testNoteId
    });
}

export function logMemoryPrune(state, noteId, summaryText) {
    state.logger.log(`Note ${noteId} memory pruned. Summary: ${summaryText}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        summary: summaryText.substring(0, 50) + '...' // Show snippet of summary
    });
}

export function logTestRunnerStart(state, noteId, testFile) {
    state.logger.log(`Running tests for note ${noteId} using ${testFile}...`, 'info', {
        component: 'TestRunner',
        noteId: noteId,
        testFile: testFile
    });
}

export function logNoteRunFinalized(state, noteId, status) {
    state.logger.log(`Note ${noteId} execution finalized with status: ${status}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        status: status
    });
}

export function logNoteFailure(state, noteId, error) {
    state.logger.log(`Note ${noteId} execution failed: ${error}`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        errorType: 'NoteExecutionError',
        error: error.message
    });
}

export function logRetryExecutionQueued(state, noteId) {
    state.logger.log(`Note ${noteId} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: noteId});
}

export function logUnitTestRequested(state, noteId, testNoteId) {
    state.logger.log(`Unit test requested for Note ${noteId}, test Note ${testNoteId} created.`, 'info', {
        component: 'NoteRunner',
        noteId: noteId,
        testNoteId: testNoteId
    });
}

export function logWebSocketConnect(state) {
    state.logger.log('Client connected', 'info', {component: 'WebSocket'});
}

export function logWebSocketDisconnect(state) {
    state.logger.log('Client disconnected', 'info', {component: 'WebSocket'});
}

export function logNoteQueueLength(state, noteId, readyQueueLength) {
    state.logger.log(`Running note ${noteId}, ${readyQueueLength} steps ready`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        readyQueueLength: readyQueueLength
    });
}

export function logStepNotFound(state, noteId, stepId) {
    state.logger.log(`Step ${stepId} not found in note ${noteId}`, 'warn', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId
    });
}

export function logStepNotPending(state, noteId, stepId, stepStatus) {
    state.logger.log(`Step ${stepId} in note ${noteId} is not pending, skipping. Status: ${stepStatus}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        stepStatus: stepStatus
    });
}

export function logStepError(state, noteId, stepId, toolName, error) {
    state.logger.log(`Error executing step ${stepId} of note ${noteId} with tool ${toolName}: ${error}`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        toolName: toolName,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
    });
}

export function logTestPass(state, noteId, testFile) {
    state.logger.log(`Tests for note ${noteId} passed.`, 'info', {
        component: 'TestRunner',
        noteId: noteId,
        testFile: testFile
    });
}

export function logTestFail(state, noteId, testFile, error) {
    state.logger.log(`Tests failed for note ${noteId}: ${error}`, 'error', {
        component: 'TestRunner',
        noteId: noteId,
        testFile: testFile,
        error: error.message
    });
}

export function logNoteFinalized(state, noteId, status) {
    state.logger.log(`Note ${noteId} execution finalized.`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        status: status
    });
}
export async function handleToolStepError(state, note, step, error) {
    step.status = 'failed';
    step.error = error.message;
    state.logger.log(`Error executing tool ${step.tool} for note ${note.id}: ${error}`, 'error', {
        component: 'NoteRunner',
        noteId: note.id,
        stepId: step.id,
        toolName: step.tool,
        errorType: 'ToolExecutionError',
        error: error.message
    });
    await state.serverCore.writeNoteToDB(note);
}
