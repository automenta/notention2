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
                    this.state.log(`Step ${stepId} not found in note ${note.id}`, 'warn', { component: 'NoteRunner', noteId: note.id, stepId: stepId });
                    continue;
                }

                if (step.status !== 'pending') {
                    this.state.log(`Step ${stepId} in note ${note.id} is not pending, skipping. Status: ${step.status}`, 'debug', { component: 'NoteRunner', noteId: note.id, stepId: stepId, stepStatus: step.status });
                    continue;
                }


                step.status = 'running';
                this.state.log(`Executing step ${step.id} of note ${note.id} with tool ${step.tool}`, 'debug', { component: 'NoteRunner', noteId: note.id, stepId: step.id, toolName: step.tool });
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

                } finally {
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
            this.state.executionQueue.delete(note.id);
        }
    }


    async _executeStep(note, step, memoryMap) {
        const tool = this.state.tools.getTool(step.tool);
        if (!tool) return this._handleToolNotFoundError(note, step);
        try {
            const result = await tool.execute(step.input, {graph: this.state.graph, llm: this.state.llm});
            memoryMap.set(step.id, result);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
        } catch (error) {
            this._handleToolStepError(note, step, error);
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
    this.state.log(`Tests failed for note ${note.id}: ${error}`, 'error', {
        component: 'TestRunner',
        noteId: note.id,
        testFile: testFile,
        error: error.message
    });
}
}
}

async
_finalizeNoteRun(note)
{
    this.state.log(`Note ${note.id} execution finalized.`, 'debug', {
        component: 'NoteRunner',
        noteId: note.id,
        status: note.status
    });
    return note;
}

_handleNoteError(note, error)
{
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

_handleToolNotFoundError(note, step)
{
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

_handleToolStepError(note, step, error)
{
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

_handleFailure(note, error)
{
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


shouldRetry(error)
{
    return error.message.includes('timeout') || error.message.includes('rate limit');
}

retryExecution(note)
{
    note.status = 'pending';
    this.state.writeNoteToDB(note);
    this.state.queueExecution(note);
    this.state.log(`Note ${note.id} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: note.id});
}


shouldRequestUnitTest(note, error)
{
    return stepErrorTypes.includes(error.errorType) || note.logic.some(step => step.tool === 'code_gen' && step.status === 'failed');
}


async
requestUnitTest(note)
{
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
import {CONFIG} from './config.js';
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
