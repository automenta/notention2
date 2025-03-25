```javascript
import { CONFIG } from './config.js';
import crypto from 'crypto';
import { z } from 'zod';

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];

import { ErrorHandler } from './error_handler.js'; // Import ErrorHandler
import { logToolStart, replacePlaceholders, logNoteStart, logNoteFinalize, logNoteQueueLength, logStepError, logStepNotFound, logStepNotPending, logTestFail, logTestPass, logMemoryPrune, logNoteRunFinalized, logNoteFailure, logRetryExecutionQueued, logTestRunnerStart, logUnitTestRequested } from './utils.js';

export class NoteRunner {
    noteStepHandler;
    errorHandler; // Declare ErrorHandler

    constructor(serverState) {
        this.state = serverState;
        this.errorHandler = new ErrorHandler(serverState); // Instantiate ErrorHandler
    }

    async runNote(note) {
        if (this.state.queueManager.executionQueue.has(note.id)) return note;
        this.state.queueManager.executionQueue.add(note.id);
        try {
            logNoteStart(this.state, note.id);
            note.status = 'running';
            await this.state.serverCore.writeNoteToDB(note);
            this.state.queueManager.updateAnalytics(note, 'start');

            const memoryMap = new Map(note.memory.map(m => [m.stepId || m.timestamp, m.content]));
            const stepsById = new Map(note.logic.map(step => [step.id, step]));
            const dependencies = new Map(note.logic.map(step => [step.id, new Set(step.dependencies)]));
            const readyQueue = note.logic.filter(step => !step.dependencies.length && step.status === 'pending').map(s => s.id);

            logNoteQueueLength(this.state, note.id, readyQueue.length);

            while (readyQueue.length) {
                const stepId = readyQueue.shift();
                const step = stepsById.get(stepId);
                if (!step) {
                    logStepNotFound(this.state, note.id, stepId);
                    continue;
                }

                if (step.status !== 'pending') {
                    logStepNotPending(this.state, note.id, stepId, step.status);
                    continue;
                }

                step.status = 'running';
                logToolStart(this.state, note.id, step.id, step.tool);
                step.input = replacePlaceholders(step.input, memoryMap);

                try {
                    await this.noteStepHandler.handleStep(note, step, memoryMap);
                } catch (error) {
                    step.status = 'failed';
                    logStepError(this.state, note.id, step.id, step.tool, error);
                    note.memory.push({
                        type: 'stepError',
                        content: errorMsg,
                        timestamp: Date.now(),
                        stepId: step.id,
                        errorName: error.name,
                        errorMessage: error.message
                    });
                    await this.state.serverCore.writeNoteToDB(note);
                    return this._handleFailure(note, {message: errorMsg, errorType: 'StepExecutionError'});

                }
                this._processStepDependencies(dependencies, stepsById, readyQueue, stepId, note);
            }

            await this._updateNoteStatusPostExecution(note);
            await this._runNoteTests(note);
            await this._pruneMemory(note);
            this.state.updateAnalytics(note, 'complete');
            return await this._finalizeNoteRun(note);
        } catch (error) {
            return this._handleNoteError(note, error);
        } finally {
            logNoteFinalize(this.state, note.id, note.status);
            this.state.executionQueue.delete(note.id);
        }
    }


    async _executeStep(note, step, memoryMap) {
        const tool = this.state.tools.getTool(step.tool);
        if (!tool) return this.errorHandler.handleToolNotFoundError(note, step);
        try {
            const result = await tool.execute(step.input, {graph: this.state.graph, llm: this.state.llm});
            memoryMap.set(step.id, result);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
        } catch (error) {
            this.errorHandler.handleToolStepError(note, step, error);
        }
        await this.state.serverCore.writeNoteToDB(note);
    }


    async _pruneMemory(note) {
        if (note.memory.length > 100) {
            const summary = await this.state.llm.invoke([`
$
{
    JSON.stringify(note.memory.slice(0, 50))
}
`]);
            note.memory = [
                {type: 'summary', content: summary.text, timestamp: Date.now()},
                ...note.memory.slice(-50)
            ];
            await this.state.serverCore.writeNoteToDB(note);
            logMemoryPrune(this.state, note.id, summary.text);
        }
    }


    _processStepDependencies(dependencies, stepsById, readyQueue, stepId, note) {
        for (const [currentStepId, deps] of dependencies.entries()) {
            if (deps.has(stepId)) {
                deps.delete(stepId);
                if (!deps.size) readyQueue.push(currentStepId);
            }
        }
    }

    async _updateNoteStatusPostExecution(note) {
        const pendingSteps = note.logic.filter(step => step.status === 'pending').length;
        if (!pendingSteps) note.status = 'completed';
        await this.state.writeNoteToDB(note);
    }

    async _runNoteTests(note) {
        if (!CONFIG.AUTO_RUN_TESTS || !note.tests || !note.tests.length) return;
        for (const testFile of note.tests) {
            try {
                const testModule = await import(`
await testModule.default(note, this.state);
this.state.log(`Tests for note ${note.id} passed.`, 'info', {
    component: 'NoteRunner',
    noteId: note.id,
    testFile: testFile
});
} catch
(error)
{
    logTestFail(this.state, note.id, testFile, error);
}
}
}

async
_finalizeNoteRun(note)
{
    logNoteFinalized(this.state, note.id, note.status);
    return note;
}

_handleFailure(note, error)
{
    if (this.shouldRequestUnitTest(error)) {
        this.requestUnitTest(note);
    } else {
        this.errorHandler._handleFailure(note, error);
    }
}

shouldRetry(error)
{
    return this.errorHandler.shouldRetry(error);
}

retryExecution(note)
{
    this.errorHandler.retryExecution(note);
}

shouldRequestUnitTest(note, error)
{
    return this.errorHandler.shouldRequestUnitTest(note, error);
}

async
requestUnitTest(note)
{
    this.errorHandler.requestUnitTest(note);
}
}
import { CONFIG } from './config.js';
import crypto from 'crypto';
import { z } from 'zod';

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];

import { ErrorHandler } from './error_handler.js'; // Import ErrorHandler
import { logToolStart, replacePlaceholders, logNoteStart, logNoteFinalize, logNoteQueueLength, logStepError, logStepNotFound, logStepNotPending, logTestFail, logTestPass, logMemoryPrune, logNoteRunFinalized, logNoteFailure, logRetryExecutionQueued, logTestRunnerStart, logUnitTestRequested } from './utils.js';

export class NoteRunner {
    noteStepHandler;
    server;
    errorHandler; // Declare ErrorHandler

    constructor(serverState, server) {
        this.state = serverState;
        this.server = server;
        this.errorHandler = new ErrorHandler(serverState); // Instantiate ErrorHandler
    }

    async runNote(note) {
        if (this.state.queueManager.executionQueue.has(note.id)) return note;
        this.state.queueManager.executionQueue.add(note.id);
        try {
            logNoteStart(this.state, note.id);
            note.status = 'running';
            await this.state.serverCore.writeNoteToDB(note);
            this.state.queueManager.updateAnalytics(note, 'start');

            const memoryMap = new Map(note.memory.map(m => [m.stepId || m.timestamp, m.content]));
            const stepsById = new Map(note.logic.map(step => [step.id, step]));
            const dependencies = new Map(note.logic.map(step => [step.id, new Set(step.dependencies)]));
            const readyQueue = note.logic.filter(step => !step.dependencies.length && step.status === 'pending').map(s => s.id);

            logNoteQueueLength(this.state, note.id, readyQueue.length);

            while (readyQueue.length) {
                const stepId = readyQueue.shift();
                const step = stepsById.get(stepId);
                if (!step) {
                    logStepNotFound(this.state, note.id, stepId);
                    continue;
                }

                if (step.status !== 'pending') {
                    logStepNotPending(this.state, note.id, stepId, step.status);
                    continue;
                }

                step.status = 'running';
                logToolStart(this.state, note.id, step.id, step.tool);
                step.input = replacePlaceholders(step.input, memoryMap);

                try {
                    await this.noteStepHandler.handleStep(note, step, memoryMap);
                } catch (error) {
                    step.status = 'failed';
                    logStepError(this.state, note.id, step.id, step.tool, error);
                    note.memory.push({
                        type: 'stepError',
                        content: errorMsg,
                        timestamp: Date.now(),
                        stepId: step.id,
                        errorName: error.name,
                        errorMessage: error.message
                    });
                    await this.state.writeNoteToDB(note);
                    return this._handleFailure(note, {message: errorMsg, errorType: 'StepExecutionError'});

                }
                this._processStepDependencies(dependencies, stepsById, readyQueue, stepId, note);
            }

            await this._updateNoteStatusPostExecution(note);
            await this._runNoteTests(note);
            await this._pruneMemory(note);
            this.state.queueManager.updateAnalytics(note, 'complete');
            return await this._finalizeNoteRun(note);
        } catch (error) {
            return this._handleNoteError(note, error);
        } finally {
            logNoteFinalize(this.state, note.id, note.status);
            this.state.executionQueue.delete(note.id);
        }
    }


    async _executeStep(note, step, memoryMap) {
        const tool = this.state.tools.getTool(step.tool);
        if (!tool) return this.errorHandler.handleToolNotFoundError(note, step);
        try {
            const result = await tool.execute(step.input, {graph: this.state.graph, llm: this.state.llm});
            memoryMap.set(step.id, result);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
        } catch (error) {
            this.errorHandler.handleToolStepError(note, step, error);
        }
        await this.state.writeNoteToDB(note);
    }


    async _pruneMemory(note) {
        if (note.memory.length > 100) {
            const summary = await this.state.llm.invoke([`
$
{
    JSON.stringify(note.memory.slice(0, 50))
}
`]);
            note.memory = [
                {type: 'summary', content: summary.text, timestamp: Date.now()},
                ...note.memory.slice(-50)
            ];
            await this.state.writeNoteToDB(note);
            logMemoryPrune(this.state, note.id, summary.text);
        }
    }


    _processStepDependencies(dependencies, stepsById, readyQueue, stepId, note) {
        for (const [currentStepId, deps] of dependencies.entries()) {
            if (deps.has(stepId)) {
                deps.delete(stepId);
                if (!deps.size) readyQueue.push(currentStepId);
            }
        }
    }

    async _updateNoteStatusPostExecution(note) {
        const pendingSteps = note.logic.filter(step => step.status === 'pending').length;
        if (!pendingSteps) note.status = 'completed';
        await this.state.writeNoteToDB(note);
    }

    async _runNoteTests(note) {
        if (!CONFIG.AUTO_RUN_TESTS || !note.tests || !note.tests.length) return;
        for (const testFile of note.tests) {
            try {
                const testModule = await import(`file://$
{
    process.cwd()
}
/$
{
    CONFIG.TESTS_DIR
}
/$
{
    testFile
}
`);
                await testModule.default(note, this.state);
                this.state.log(`Tests for note $
{
    note.id
}
 passed.`, 'info', {
                    component: 'NoteRunner',
                    noteId: note.id,
                    testFile: testFile
                });
            } catch (error) {
                logTestFail(this.state, note.id, testFile, error);
            }
        }
    }

    async _finalizeNoteRun(note) {
        logNoteRunFinalized(this.state, note.id, note.status);
        return note;
    }

    _handleFailure(note, error) {
        if (this.shouldRequestUnitTest(error)) {
            this.requestUnitTest(note);
        } else {
            this.errorHandler._handleFailure(note, error);
        }
    }

    shouldRetry(error) {
        return this.errorHandler.shouldRetry(error);
    }

    retryExecution(note) {
        this.errorHandler.retryExecution(note);
    }

    shouldRequestUnitTest(note, error) {
        return this.errorHandler.shouldRequestUnitTest(note, error);
    }

    async requestUnitTest(note) {
        this.errorHandler.requestUnitTest(note);
    }
}
