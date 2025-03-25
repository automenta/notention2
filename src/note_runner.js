```javascript
import { CONFIG } from './config.js';
import crypto from 'crypto';
import { z } from 'zod';

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError']; // Define stepErrorTypes here

export class NoteRunner {
    constructor(serverState) {
        this.state = serverState;
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
                    continue; // Skip to next step if this one is not found
                }

                if (step.status !== 'pending') {
                    this.state.log(`Step ${stepId} in note ${note.id} is not pending, skipping. Status: ${step.status}`, 'debug', { component: 'NoteRunner', noteId: note.id, stepId: stepId, stepStatus: step.status });
                    continue; // Skip if step is not pending
                }


                step.status = 'running'; // Mark step as running *before* execution
                this.state.log(`Executing step ${step.id} of note ${note.id} with tool ${step.tool}`, 'debug', { component: 'NoteRunner', noteId: note.id, stepId: step.id, toolName: step.tool });
                step.input = this.state.replacePlaceholders(step.input, memoryMap);


                try {
                    switch (step.tool) {
                        case 'summarize':
                            await this.handleSummarize(note, step);
                            break;
                        case 'generateCode':
                            await this.handleGenerateCode(note, step);
                            break;
                        case 'reflect': // New Tool - Reflect
                            await this.handleReflect(note, step);
                            break;
                        case 'test_gen': // New Tool - Test Generation
                            await this.handleTestGeneration(note, step);
                            break;
                        case 'test_run': // New Tool - Test Execution
                            await this.handleTestExecution(note, step);
                            break;
                        case 'knowNote':
                            await this.handleKnowNote(note, step);
                            break;
                        case 'analytics':
                            await this.handleAnalytics(note, step);
                            break;
                        case 'fetchExternal':
                            await this.handleFetchExternal(note, step);
                            break;
                        case 'collaborate':
                            await this.handleCollaboration(note, step);
                            break;
                        case 'generateTool':
                            await this.handleToolGeneration(note, step);
                            break;
                        default:
                            await this.executeStep(note, step, memoryMap);
                    }
                } catch (error) {
                    step.status = 'failed'; // Mark step as failed if execution error
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
                    await this.state.writeNoteToDB(note); // Write note state with failure details immediately
                    return this.handleFailure(note, {message: errorMsg, errorType: 'StepExecutionError'}); // Handle note-level failure

                } finally {
                    // Ensure note is written to DB even if step execution fails
                    // (already done in catch block above, but kept for clarity - can be removed if needed)
                }
                this._processStepDependencies(dependencies, stepsById, readyQueue, stepId, note);
            }

            await this._updateNoteStatusPostExecution(note);
            await this._runNoteTests(note);
            await this.pruneMemory(note);
            this.state.updateAnalytics(note, 'complete');
            return await this._finalizeNoteRun(note);
        } catch (error) {
            return this._handleNoteError(note, error);
        } finally {
            this.state.executionQueue.delete(note.id);
        }
    }

    async handleTestGeneration(note, step) {
        const {code, targetId} = step.input;
        try {
            const testCode = await this.state.tools.executeTool('test_gen', {code, targetId}, {graph: this.state.graph, llm: this.state.llm});
            const testNoteId = crypto.randomUUID();
            const testNote = {
                id: testNoteId,
                title: `Test for ${targetId}`,
                content: {type: 'test', code: testCode},
                status: 'pending',
                priority: 75,
                references: [targetId],
                createdAt: new Date().toISOString()
            };
            this.state.graph.addNote(testNote);
            note.memory.push({type: 'testGen', content: `Generated test ${testNoteId} for ${targetId}`, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.writeNoteToDB(note);
            this.state.queueExecution(testNote); // Queue the test note for execution immediately
            return testNoteId;
        } catch (error) {
            step.status = 'failed';
            note.memory.push({type: 'testGenError', content: `Test generation failed: ${error.message}`, timestamp: Date.now(), stepId: step.id});
            await this.state.writeNoteToDB(note);
            return `Test generation failed: ${error.message}`;
        }
    }

    async handleTestExecution(note, step) {
        const {testId} = step.input;
        try {
            const results = await this.state.tools.executeTool('test_run', {testId}, {graph: this.state.graph, llm: this.state.llm});
            note.memory.push({type: 'testRun', content: `Executed test ${testId}: ${results}`, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.writeNoteToDB(note);
            return results;
        } catch (error) {
            step.status = 'failed';
            note.memory.push({type: 'testRunError', content: `Test execution failed: ${error.message}`, timestamp: Date.now(), stepId: step.id});
            await this.state.writeNoteToDB(note);
            return `Test execution failed: ${error.message}`;
        }
    }


    async handleCollaboration(note, step) {
        const {noteIds} = step.input;
        const collabResult = await this.state.llm.invoke(
            [`Collaborate on "${note.title}" with notes: ${noteIds.join(', ')}`],
            noteIds
        );
        note.memory.push({type: 'collab', content: collabResult.text, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.state.writeNoteToDB(note);
    }

    async handleToolGeneration(note, step) {
        const {name, desc, code} = step.input;
        const toolDef = {name, description: desc, schema: z.object({}), invoke: new Function('input', 'context', code)};
        this.state.tools.addTool(toolDef);
        note.memory.push({type: 'toolGen', content: `Generated tool ${name}`, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.state.writeNoteToDB(note);
    }

    async handleKnowNote(note, step) {
        const {title, goal} = step.input;
        const newNoteId = crypto.randomUUID();
        const newNote = {
            id: newNoteId,
            title,
            content: goal,
            status: 'pending',
            logic: [],
            memory: [],
            createdAt: new Date().toISOString(),
        };
        this.state.graph.addNote(newNote);
        note.memory.push({type: 'know', content: `Knew ${newNoteId}`, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.state.writeNoteToDB(note);
        this.state.queueExecution(newNote);
    }

    async handleAnalytics(note, step) {
        const {targetId} = step.input;
        const target = this.state.graph.getNote(targetId);
        if (!target) throw new Error(`Note ${targetId} not found`);
        const analytics = this.state.analytics.get(targetId) || {usage: 0, runtime: 0};
        const result = `Usage: ${analytics.usage}, Avg Runtime: ${analytics.runtime / (analytics.usage || 1)}ms`;
        note.memory.push({type: 'analytics', content: result, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.state.writeNoteToDB(note);
    }

    async handleFetchExternal(note, step) {
        const {apiName, query} = step.input;
        const data = await this.state.llm.fetchExternalData(apiName, query);
        note.memory.push({type: 'external', content: JSON.stringify(data), timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await this.state.writeNoteToDB(note);
    }

    async handleSummarize(note, step) { // Consistent handler name
        try {
            const result = await this.state.tools.executeTool('summarize', step.input, { graph: this.state.graph, llm: this.state.llm }); // Use 'summarize' tool name
            note.memory.push({ type: 'tool', content: result, timestamp: Date.now(), stepId: step.id });
            step.status = 'completed';
            await this.state.writeNoteToDB(note);
        } catch (error) {
            this._handleToolStepError(note, step, error);
        }
    }

    async handleGenerateCode(note, step) {
        try {
            const result = await this.state.tools.executeTool('generateCode', step.input, {graph: this.state.graph, llm: this.state.llm});
            note.memory.push({type: 'codeGen', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.writeNoteToDB(note);
        } catch (error) {
            this._handleToolStepError(note, step, error);
        }
    }

    async handleReflect(note, step) {
        try {
            const result = await this.state.tools.executeTool('reflect', step.input, {graph: this.state.graph, llm: this.state.llm});
            note.memory.push({type: 'reflect', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.writeNoteToDB(note);
        } catch (error) {
            this._handleToolStepError(note, step, error);
        }
    }


    async executeStep(note, step, memoryMap) {
        const tool = this.state.tools.getTool(step.tool);
        if (!tool) return this._handleToolNotFoundError(note, step);
        try {
            // --- Use Tool.execute method for consistent execution ---
            const result = await tool.execute(step.input, {graph: this.state.graph, llm: this.state.llm});
            // --- End of tool execution ---
            memoryMap.set(step.id, result);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
        } catch (error) {
            this._handleToolStepError(note, step, error);
        }
        await this.state.writeNoteToDB(note);
    }

    async pruneMemory(note) {
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
        await this.writeNoteToDB(note);
    }

    async _runNoteTests(note) {
        if (!CONFIG.AUTO_RUN_TESTS || !note.tests || !note.tests.length) return;
        for (const testFile of note.tests) {
            try {
                const testModule = await import(`file://${process.cwd()}/${CONFIG.TESTS_DIR}/${testFile}`);
                await testModule.default(note, this.state); // Assuming tests are written as async functions
                this.state.log(`Tests for note ${note.id} passed.`, 'info', {
                    component: 'TestRunner',
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

    _handleNoteError(note, error) {
        this.state.log(`Error running note ${note.id}: ${error}`, 'error', {
            component: 'NoteRunner',
            noteId: note.id,
            errorType: 'NoteExecutionError',
            error: error.message
        });
        note.status = 'failed';
        note.error = error.message;
        this.writeNoteToDB(note);
        return note;
    }

    _handleToolNotFoundError(note, step) {
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
        this.writeNoteToDB(note);
        return errorMsg;
    }

    _handleToolStepError(note, step, error) {
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
        this.writeNoteToDB(note);
        return `Tool execution failed: ${error.message}`;
    }

    handleFailure(note, error) {
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
            note.status = 'failed'; // Set status to failed if no recovery
            this.state.writeNoteToDB(note);
        }
    }


    shouldRetry(error) {
        // Basic retry condition - can be expanded
        return error.message.includes('timeout') || error.message.includes('rate limit');
    }

    retryExecution(note) {
        note.status = 'pending'; // Reset status to pending for retry
        this.state.writeNoteToDB(note);
        this.queueExecution(note); // Re-queue for execution
        this.state.log(`Note ${note.id} queued for retry.`, 'debug', {component: 'NoteRunner', noteId: note.id});
    }


    shouldRequestUnitTest(note, error) {
        // Request unit test if tool execution failed or code generation failed
        return stepErrorTypes.includes(error.errorType) || note.logic.some(step => step.tool === 'code_gen' && step.status === 'failed');
    }


    async requestUnitTest(note) {
        if (!note.tests) note.tests = [];
        const testId = crypto.randomUUID();
        note.tests.push(testId); // Assign a test ID to the note
        note.status = 'pendingUnitTesting';
        await this.writeNoteToDB(note);


        const testNote = {
            id: testId,
            title: `Unit Test for ${note.title}`,
            content: {
                type: 'test',
                targetNoteId: note.id // Reference the note to be tested
            },
            status: 'pending',
            priority: 60, // Higher priority for tests
            createdAt: new Date().toISOString(),
            references: [note.id] // Create reference to the note being tested
        };
        this.state.graph.addNote(testNote);
        await this.writeNoteToDB(testNote);
        this.queueExecution(testNote); // Queue the test note for execution
        this.state.log(`Unit test requested for Note ${note.id}, test Note ${testId} created.`, 'info', {
            component: 'NoteRunner',
            noteId: note.id,
            testNoteId: testId
        });
    }
}

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];


export default NetentionServer;
