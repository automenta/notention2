```javascript
import {CONFIG} from './config.js';
import path from 'path'; // ADDED
import {
    logNoteStart,
    logNoteFinalize,
    logNoteQueueLength,
    logStepError,
    logStepNotFound,
    logStepNotPending,
    logTestFail,
    logMemoryPrune,
    replacePlaceholders
} from './utils.js';
import {
    NoteExecutionError
} from './errors.js';

export class NoteRunner {
    constructor(serverState) {
        this.state = serverState;
        this.errorHandler = this.state.errorHandler;
    }

    async runNote(note) {
        if (this.state.queueManager.executionQueue.has(note.id)) return note;
        this.state.queueManager.executionQueue.add(note.id);
        try {
            await this._initializeNoteExecution(note);
            await this._processNoteSteps(note);
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
        }
    }

    async _initializeNoteExecution(note) {
        logNoteStart(this.state, note.id);
        note.status = 'running';
        await this.state.serverCore.writeNoteToDB(note);
        this.state.queueManager.updateAnalytics(note, 'start');
    }

    async _processNoteSteps(note) {
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
            this.state.logger.log(`Executing step ${step.id} of note ${note.id} with tool ${step.tool}`, 'debug', {
                component: 'NoteRunner',
                noteId: note.id,
                stepId: step.id,
                toolName: step.tool
            });
            step.input = replacePlaceholders(step.input, memoryMap);

            try {
                await this.state.noteStepHandler.handleStep(note, step, memoryMap);
            } catch (error) {
                step.status = 'failed';
                logStepError(this.state, note.id, step.id, step.tool, error);
                note.memory.push({
                    type: 'stepError',
                    content: error.message,
                    timestamp: Date.now(),
                    stepId: step.id,
                    errorName: error.name,
                    errorMessage: error.message
                });
                await this.state.serverCore.writeNoteToDB(note);
                return this._handleFailure(note, error);
            }
            this._processStepDependencies(dependencies, stepsById, readyQueue, stepId, note);
        }
    }

    async _pruneMemory(note) {
        if (note.memory.length > 100) {
            const summary = await this.state.llm.invoke([`Summarize: ${JSON.stringify(note.memory.slice(-50))}`]); // Invoke LLM to summarize memory
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
                const testModule = await import(new URL(path.join(process.cwd(), CONFIG.TESTS_DIR, testFile), import.meta.url).href);
                await testModule.default(note, this.state);
                this.state.logger.log(`Tests for note ${note.id} passed.`, 'info', {
                    component: 'TestRunner',
                    noteId: note.id,
                    testFile: testFile
                });
            } catch (error) {
                logTestFail(this.state, note.id, testFile, error);
            }
        }
    }

    async _finalizeNoteRun(note) {
        this.state.logger.log(`Note ${note.id} execution finalized.`, 'debug', {
            component: 'NoteRunner',
            noteId: note.id,
            status: note.status
        });
        return note;
    }

    _handleFailure(note, error) {
        this.state.logger.log(`Note ${note.id} execution failed: ${error}`, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            errorType: 'NoteExecutionError',
            error: error.message
        });

        if (this.shouldRetry(error)) {
            this.retryExecution(note);
        } else if (this.shouldRequestUnitTest(note, error)) {
            this.requestUnitTest(note);
        } else {
            note.status = 'failed';
            note.error = error.message;
            this.state.serverCore.writeNoteToDB(note);
        }
        return note;
    }

    shouldRetry(error) {
        // Basic retry condition - can be expanded
        return error.message.includes('timeout') || error.message.includes('rate limit');
    }

    async retryExecution(note) {
        note.status = 'pending'; // Reset status to pending for retry
        await this.state.serverCore.writeNoteToDB(note);
        this.state.queueManager.queueExecution(note); // Re-queue for execution
        this.state.logger.log(`Note ${note.id} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: note.id});
    }

    shouldRequestUnitTest(note, error) {
        // Request unit test if tool execution failed or code generation failed
        return note.logic.some(step => step.tool === 'code_gen' && step.status === 'failed');
    }

    async requestUnitTest(note) {
        if (!note.tests) note.tests = [];
        const testId = crypto.randomUUID();
        note.tests.push(testId); // Assign a test ID to the note
        note.status = 'pendingUnitTesting';
        await this.state.serverCore.writeNoteToDB(note);

        this.state.logger.log(`Unit test requested for Note ${note.id}, test Note ${testId} created.`, 'info', {
            component: 'NoteRunner',
            noteId: note.id,
            testNoteId: testId
        });

        const testNote = this._createTestNote(note, testId);
        this.state.graph.addNote(testNote);
        this.state.queueManager.queueExecution(testNote);
    }

    _createTestNote(note, testId) {
        return {
            id: testId,
            title: `Test for ${note.title}`,
            content: {type: 'test', code: ''},
            status: 'pending',
            priority: 75,
            references: [note.id],
            createdAt: new Date().toISOString()
        };
    }
}
