import crypto from 'crypto';
import { z } from 'zod';

async function executeToolStep(state, note, step, toolName, memoryMap, errorHandler) {
    try {
        const result = await state.tools.executeTool(toolName, step.input, {
            graph: state.graph,
            llm: state.llm
        });
        memoryMap.set(step.id, result);
        note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await state.serverCore.writeNoteToDB(note);
        return result;
    } catch (error) {
        step.status = 'failed';
        errorHandler.handleToolStepError(note, step, error);
        return `Tool execution failed: ${error.message}`;
    }
}

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];

export class NoteStepHandler {
    errorHandler;

    constructor(serverState, errorHandler) {
        this.state = serverState;
        this.errorHandler = errorHandler;
    }

    async handleStep(note, step, memoryMap) {
        switch (step.tool) {
            case 'summarize':
                await this.handleSummarizeStep(note, step, memoryMap);
                break;
            case 'generateCode':
                await this.handleGenerateCodeStep(note, step, memoryMap);
                break;
            case 'reflect':
                await this.handleReflectStep(note, step, memoryMap);
                break;
            case 'test_gen':
                await this.handleTestGeneration(note, step, memoryMap);
                break;
            case 'test_run':
                await this.handleTestExecution(note, step, memoryMap);
                break;
            case 'knowNote':
                await this.handleKnowNote(note, step, memoryMap);
                break;
            case 'analytics':
                await this.handleAnalytics(note, step, memoryMap);
                break;
            case 'fetchExternal':
                await this.handleFetchExternal(note, step, memoryMap);
                break;
            case 'collaborate':
                await this.handleCollaboration(note, step, memoryMap);
                break;
            case 'generateTool':
                await this.handleToolGeneration(note, step, memoryMap);
                break;
            default:
                await this.handleDefaultStep(note, step, memoryMap);
        }
    }

    async handleTestGeneration(note, step, memoryMap) {
        const {code, targetId} = step.input;
        try {
            const testCode = await executeToolStep(this.state, note, step, 'test_gen', memoryMap, this.errorHandler);
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
            note.memory.push({
                type: 'testGen',
                content: `Generated test ${testNoteId} for ${targetId}`,
                timestamp: Date.now(),
                stepId: step.id
            });
            this.state.queueManager.queueExecution(testNote);
            return testNoteId;
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
            return `Test generation failed: ${error.message}`;
        }
    }

    async handleTestExecution(note, step, memoryMap) {
        const {testId} = step.input;
        try {
            const results = await executeToolStep(this.state, note, step, 'test_run', memoryMap, this.errorHandler);
            note.memory.push({
                type: 'testRun',
                content: `Executed test ${testId}: ${results}`,
                timestamp: Date.now(),
                stepId: step.id
            });
            return results;
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
            return `Test execution failed: ${error.message}`;
        }
    }

    async handleCollaboration(note, step, memoryMap) {
        const {noteIds} = step.input;
        try {
            const collabResult = await this.state.llm.invoke(
                [`Collaborate on "${note.title}" with notes: ${noteIds.join(', ')}`],
                noteIds
            );
            note.memory.push({type: 'collab', content: collabResult.text, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleToolGeneration(note, step, memoryMap) {
        const {name, desc, code} = step.input;
        try {
            const toolDef = {name, description: desc, schema: z.object({}), invoke: new Function('input', 'context', code)};
            this.state.tools.addTool(toolDef);
            note.memory.push({type: 'toolGen', content: `Generated tool ${name}`, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleKnowNote(note, step, memoryMap) {
        const {title, goal} = step.input;
        try {
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
            await this.state.serverCore.writeNoteToDB(note);
            this.state.queueManager.queueExecution(newNote);
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleAnalytics(note, step, memoryMap) {
        const {targetId} = step.input;
        try {
            const target = this.state.graph.getNote(targetId);
            if (!target) throw new Error(`Note ${targetId} not found`);
            const analytics = this.state.queueManager.analytics.get(targetId) || {usage: 0, runtime: 0};
            const result = `Usage: ${analytics.usage}, Avg Runtime: ${analytics.runtime / (analytics.usage || 1)}ms`;
            note.memory.push({type: 'analytics', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleFetchExternal(note, step, memoryMap) {
        const {apiName, query} = step.input;
        try {
            const data = await this.state.llm.fetchExternalData(apiName, query);
            note.memory.push({type: 'external', content: JSON.stringify(data), timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleSummarizeStep(note, step, memoryMap) {
        try {
            const result = await executeToolStep(this.state, note, step, 'summarize', memoryMap, this.errorHandler);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleGenerateCodeStep(note, step, memoryMap) {
         try {
            const result = await executeToolStep(this.state, note, step, 'generateCode', memoryMap, this.errorHandler);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleReflectStep(note, step, memoryMap) {
        try {
            const result = await executeToolStep(this.state, note, step, 'reflect', memoryMap, this.errorHandler);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleDefaultStep(note, step, memoryMap) {
        const tool = this.state.tools.getTool(step.tool);
        if (!tool) return this.errorHandler.handleToolNotFoundError(note, step);
        try {
            const result = await tool.execute(step.input, {graph: this.state.graph, llm: this.state.llm});
            memoryMap.set(step.id, result);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }
}
