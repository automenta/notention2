```javascript
import { CONFIG } from './config.js';
import crypto from 'crypto';
import { z } from 'zod';
import path from 'path'; // ADDED

import { ErrorHandler } from './error_handler.js';
import { logToolStart, replacePlaceholders, logNoteStart, logNoteFinalize, logNoteQueueLength, logStepError, logStepNotFound, logStepNotPending, logTestFail, logTestPass, logMemoryPrune, logNoteRunFinalized, logNoteFailure, logRetryExecutionQueued, logTestRunnerStart, logUnitTestRequested } from './utils.js';

export class NoteRunner {
    noteStepHandler;
    server;
    errorHandler;

    constructor(serverState, server) {
        this.state = serverState;
        this.server = server;
        this.errorHandler = new ErrorHandler(serverState);
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
                        content: error.message, // Changed from errorMsg
                        timestamp: Date.now(),
                        stepId: step.id,
                        errorName: error.name,
                        errorMessage: error.message
                    });
                    await this.state.serverCore.writeNoteToDB(note);
                    return this._handleFailure(note, error); // Changed to pass error directly

                }
                this._processStepDependencies(dependencies, stepsById, readyQueue, stepId, note);
            }

            await this._updateNoteStatusPostExecution(note);
            await this._runNoteTests(note);
            await this._pruneMemory(note);
            this.state.queueManager.updateAnalytics(note, 'complete');
            return await this._finalizeNoteRun(note);
        } catch (error) {
            return this.errorHandler.handleNoteError(note, error);
        } finally {
            logNoteFinalize(this.state, note.id, note.status);
            this.state.queueManager.executionQueue.delete(note.id);
        } finally {
            logNoteFinalize(this.state, note.id, note.status);
            this.state.queueManager.executionQueue.delete(note.id);
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
            return this.errorHandler.handleToolStepError(note, step, error);
        }
        await this.state.serverCore.writeNoteToDB(note); // Corrected line
    }


    async _pruneMemory(note) {
        if (note.memory.length > 100) {
            const summary = await this.state.llm.invoke([`
${JSON.stringify(note.memory.slice(0, 50))}
`]); // Corrected template literal
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
        await this.state.serverCore.writeNoteToDB(note);
    }

    async _runNoteTests(note) {
        if (!CONFIG.AUTO_RUN_TESTS || !note.tests || !note.tests.length) return;
        for (const testFile of note.tests) {
            try {
                // Corrected import path using path.join
                const testModule = await import(`file://${path.join(process.cwd(), CONFIG.TESTS_DIR, testFile)}`);
                await testModule.default(note, this.state);
                this.state.log(`Tests for note ${note.id} passed.`, 'info', {
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
}
