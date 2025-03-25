```javascript
import { CONFIG } from './config.js';
import crypto from 'crypto';
import { z } from 'zod';
import { NoteStepHandler } from './note_step_handler.js'; // Import NoteStepHandler

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];

import { ErrorHandler } from './error_handler.js'; // Import ErrorHandler

export class NoteRunner {
    noteStepHandler;
    errorHandler; // Declare ErrorHandler

    constructor(serverState, noteStepHandler) {
        this.state = serverState;
        this.noteStepHandler = noteStepHandler;
        this.errorHandler = new ErrorHandler(serverState); // Instantiate ErrorHandler
    }

    async runNote(note) {
        if (this.state.executionQueue.has(note.id)) return note;
        this.state.executionQueue.add(note.id);
        try {
            note.status = 'running';
            await this.state.writeNoteToDB(note);
            this.state.updateAnalytics(note, 'start');

            const memoryMap = new Map(note.memory.map(m => [m.stepId || m.timestamp, m.content]));
            const stepsById = new Map(note.logic.map(step => [step.id, step]));
            const dependencies = new Map(note.logic.map(step => [step.id, new Set(step.dependencies)]));
            const readyQueue = note.logic.filter(step => !step.dependencies.length && step.status === 'pending').map(s => s.id);

            this.state.log(`Running note ${note.id}, ${readyQueue.length} steps ready`, 'debug', { component: 'NoteRunner', noteId: note.id, readyQueueLength: readyQueue.length });


            while (readyQueue.length) {
                const stepId = readyQueue.shift();
                const step = stepsById.get(stepId);
                if (!step) {
                    this.state.log(`
Step
$
{
    stepId
}
not
found in note
$
{
    note.id
}
`, 'warn', { component: 'NoteRunner', noteId: note.id, stepId: stepId });
                    continue;
                }

                if (step.status !== 'pending') {
                    this.state.log(`
Step
$
{
    stepId
}
in
note
$
{
    note.id
}
is
not
pending, skipping.Status
:
$
{
    step.status
}
`, 'debug', { component: 'NoteRunner', noteId: note.id, stepId: stepId, stepStatus: step.status });
                    continue;
                }


                step.status = 'running';
                this.state.log(`
Executing
step
$
{
    step.id
}
of
note
$
{
    note.id
}
with tool $
{
    step.tool
}
`, 'debug', { component: 'NoteRunner', noteId: note.id, stepId: step.id, toolName: step.tool });
                step.input = this.state.replacePlaceholders(step.input, memoryMap);


                try {
                    switch (step.tool) {
                        case 'summarize':
                            await this.noteStepHandler.handleSummarize(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'generateCode':
                            await this.noteStepHandler.handleGenerateCode(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'reflect':
                            await this.noteStepHandler.handleReflect(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'test_gen':
                            await this.noteStepHandler.handleTestGeneration(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'test_run':
                            await this.noteStepHandler.handleTestExecution(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'knowNote':
                            await this.noteStepHandler.handleKnowNote(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'analytics':
                            await this.noteStepHandler.handleAnalytics(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'fetchExternal':
                            await this.noteStepHandler.handleFetchExternal(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'collaborate':
                            await this.noteStepHandler.handleCollaboration(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'generateTool':
                            await this.noteStepHandler.handleToolGeneration(note, step); // Delegate to NoteStepHandler
                            break;
                        default:
                            await this._executeStep(note, step, memoryMap);
                    }
                } catch (error) {
                    step.status = 'failed';
                    const errorMsg = `Error executing step ${step.id} of note ${note.id} with tool ${step.tool}: ${error}`;
                    this.state.log(errorMsg, 'error', {
                        component: 'NoteRunner',
                        noteId: note.id,
                        stepId: step.id,
                        toolName: step.tool,
                        errorName: error.name,
                        errorMessage: error.message,
                        errorStack: error.stack
                    });
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
            this.state.updateAnalytics(note, 'complete');
            return await this._finalizeNoteRun(note);
        } catch (error) {
            return this.errorHandler.handleNoteError(note, error);
        } finally {
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
            const summary = await this.state.llm.invoke([`Summarize: ${JSON.stringify(note.memory.slice(0, 50))}`]);
            note.memory = [
                {type: 'summary', content: summary.text, timestamp: Date.now()},
                ...note.memory.slice(-50)
            ];
            await this.state.writeNoteToDB(note);
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
                const testModule = await import(`file://${process.cwd()}/${CONFIG.TESTS_DIR}/${testFile}`);
                await testModule.default(note, this.state);
                this.state.log(`Tests for note ${note.id} passed.`, 'info', {
                    component: 'NoteRunner',
                    noteId: note.id,
                    testFile: testFile
                });
            } catch (error) {
                this.state.log(`Tests failed for note ${note.id}: ${error}`, 'error', {
                    component: 'TestRunner',
                    noteId: note.id,
                    testFile: testFile,
                    error: error.message
                });
            }
        }
    }

    async _finalizeNoteRun(note) {
        this.state.log(`Note ${note.id} execution finalized.`, 'debug', {
            component: 'NoteRunner',
            noteId: note.id,
            status: note.status
        });
        return note;
    }

    _handleFailure(note, error) {
        this.errorHandler._handleFailure(note, error);
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
import crypto from 'crypto';
import {ErrorHandler} from './error_handler.js'; // Import ErrorHandler

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];

export class NoteRunner {
    noteStepHandler;
    errorHandler; // Declare ErrorHandler

    constructor(serverState, noteStepHandler) {
        this.state = serverState;
        this.noteStepHandler = noteStepHandler;
        this.errorHandler = new ErrorHandler(serverState); // Instantiate ErrorHandler
    }

    async runNote(note) {
        if (this.state.executionQueue.has(note.id)) return note;
        this.state.executionQueue.add(note.id);
        try {
            note.status = 'running';
            await this.state.writeNoteToDB(note);
            this.state.updateAnalytics(note, 'start');

            const memoryMap = new Map(note.memory.map(m => [m.stepId || m.timestamp, m.content]));
            const stepsById = new Map(note.logic.map(step => [step.id, step]));
            const dependencies = new Map(note.logic.map(step => [step.id, new Set(step.dependencies)]));
            const readyQueue = note.logic.filter(step => !step.dependencies.length && step.status === 'pending').map(s => s.id);

            this.state.log(`Running note ${note.id}, ${readyQueue.length} steps ready`, 'debug', {
                component: 'NoteRunner',
                noteId: note.id,
                readyQueueLength: readyQueue.length
            });


            while (readyQueue.length) {
                const stepId = readyQueue.shift();
                const step = stepsById.get(stepId);
                if (!step) {
                    this.state.log(`Step ${stepId} not found in note ${note.id}`, 'warn', {
                        component: 'NoteRunner',
                        noteId: note.id,
                        stepId: stepId
                    });
                    continue;
                }

                if (step.status !== 'pending') {
                    this.state.log(`Step ${stepId} in note ${note.id} is not pending, skipping. Status: ${step.status}`, 'debug', {
                        component: 'NoteRunner',
                        noteId: note.id,
                        stepId: stepId,
                        stepStatus: step.status
                    });
                    continue;
                }


                step.status = 'running';
                this.state.log(`Executing step ${step.id} of note ${note.id} with tool ${step.tool}`, 'debug', {
                    component: 'NoteRunner',
                    noteId: note.id,
                    stepId: step.id,
                    toolName: step.tool
                });
                step.input = this.state.replacePlaceholders(step.input, memoryMap);


                try {
                    switch (step.tool) {
                        case 'summarize':
                            await this.noteStepHandler.handleSummarize(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'generateCode':
                            await this.noteStepHandler.handleGenerateCode(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'reflect':
                            await this.noteStepHandler.handleReflect(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'test_gen':
                            await this.noteStepHandler.handleTestGeneration(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'test_run':
                            await this.noteStepHandler.handleTestExecution(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'knowNote':
                            await this.noteStepHandler.handleKnowNote(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'analytics':
                            await this.noteStepHandler.handleAnalytics(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'fetchExternal':
                            await this.noteStepHandler.handleFetchExternal(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'collaborate':
                            await this.noteStepHandler.handleCollaboration(note, step); // Delegate to NoteStepHandler
                            break;
                        case 'generateTool':
                            await this.noteStepHandler.handleToolGeneration(note, step); // Delegate to NoteStepHandler
                            break;
                        default:
                            await this._executeStep(note, step, memoryMap);
                    }
                } catch (error) {
                    step.status = 'failed';
                    const errorMsg = `Error executing step ${step.id} of note ${note.id} with tool ${step.tool}: ${error}`;
                    this.state.log(errorMsg, 'error', {
                        component: 'NoteRunner',
                        noteId: note.id,
                        stepId: step.id,

                        ``````

                    src / note_step_handler.js
                        ``````
                    javascript
                    << <
                    <
                    <
                    << SEARCH
