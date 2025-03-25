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
