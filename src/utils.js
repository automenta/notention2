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
    state.log(`Executing step ${stepId} of note ${noteId} with tool ${toolName}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        toolName: toolName
    });
}

export function logNoteStart(state, noteId) {
    state.log(`Starting execution of note ${noteId}`, 'info', {
        component: 'NoteRunner',
        noteId: noteId
    });
}

export function logNoteFinalize(state, noteId, status) {
    state.log(`Note ${noteId} execution finalized with status: ${status}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        status: status
    });
}

export function logNoteExecutionError(state, noteId, error) {
    state.log(`Error running note ${noteId}: ${error}`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        errorType: 'NoteExecutionError',
        error: error.message
    });
}

export function logToolNotFoundError(state, noteId, stepId, toolName) {
    state.log(`Tool ${toolName} not found`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        toolName: toolName,
        errorType: 'ToolNotFoundError'
    });
}

export function logToolExecutionError(state, noteId, stepId, toolName, error) {
    state.log(`Error executing tool ${toolName} for note ${noteId}: ${error}`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        toolName: toolName,
        errorType: 'ToolExecutionError',
        error: error.message
    });
}

export function logNoteRetryQueued(state, noteId) {
    state.log(`Note ${noteId} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: noteId});
}

export function logUnitTestRequestQueued(state, noteId, testNoteId) {
    state.log(`Unit test requested for Note ${noteId}, test Note ${testNoteId} created.`, 'info', {
        component: 'NoteRunner',
        noteId: noteId,
        testNoteId: testNoteId
    });
}

export function logMemoryPrune(state, noteId, summaryText) {
    state.log(`Note ${noteId} memory pruned. Summary: ${summaryText}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        summary: summaryText.substring(0, 50) + '...' // Show snippet of summary
    });
}

export function logTestRunnerStart(state, noteId, testFile) {
    state.log(`Running tests for note ${noteId} using ${testFile}...`, 'info', {
        component: 'TestRunner',
        noteId: noteId,
        testFile: testFile
    });
}

export function logNoteRunFinalized(state, noteId, status) {
    state.log(`Note ${noteId} execution finalized with status: ${status}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        status: status
    });
}

export function logNoteFailure(state, noteId, error) {
    state.log(`Note ${noteId} execution failed: ${error}`, 'error', {
        component: 'NoteRunner',
        noteId: noteId,
        errorType: 'NoteExecutionError',
        error: error.message
    });
}

export function logRetryExecutionQueued(state, noteId) {
    state.log(`Note ${noteId} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: noteId});
}

export function logUnitTestRequested(state, noteId, testNoteId) {
    state.log(`Unit test requested for Note ${noteId}, test Note ${testNoteId} created.`, 'info', {
        component: 'NoteRunner',
        noteId: noteId,
        testNoteId: testNoteId
    });
}

export function logNoteQueueLength(state, noteId, readyQueueLength) {
    state.log(`Running note ${noteId}, ${readyQueueLength} steps ready`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        readyQueueLength: readyQueueLength
    });
}

export function logStepNotFound(state, noteId, stepId) {
    state.log(`Step ${stepId} not found in note ${noteId}`, 'warn', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId
    });
}

export function logStepNotPending(state, noteId, stepId, stepStatus) {
    state.log(`Step ${stepId} in note ${noteId} is not pending, skipping. Status: ${stepStatus}`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        stepId: stepId,
        stepStatus: stepStatus
    });
}

export function logStepError(state, noteId, stepId, toolName, error) {
    state.log(`Error executing step ${stepId} of note ${noteId} with tool ${toolName}: ${error}`, 'error', {
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
    state.log(`Tests for note ${noteId} passed.`, 'info', {
        component: 'TestRunner',
        noteId: noteId,
        testFile: testFile
    });
}

export function logTestFail(state, noteId, testFile, error) {
    state.log(`Tests failed for note ${noteId}: ${error}`, 'error', {
        component: 'TestRunner',
        noteId: noteId,
        testFile: testFile,
        error: error.message
    });
}

export function logNoteFinalized(state, noteId, status) {
    state.log(`Note ${noteId} execution finalized.`, 'debug', {
        component: 'NoteRunner',
        noteId: noteId,
        status: status
    });
}
