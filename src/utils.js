export function timeoutPromise(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
}

export function replacePlaceholders(input, memoryMap) {
    if (typeof input === 'string') {
        return input.replace(/\${(\w+)}/g, (_, stepId) => memoryMap.get(stepId) || '');
    }
    return input;
}
