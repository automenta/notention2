import crypto from 'crypto';
import { z } from 'zod';
import { CONFIG } from './config.js';

const stepErrorTypes = ['ToolExecutionError', 'ToolNotFoundError'];

export class NoteStepHandler {
    constructor(serverState) {
        this.state = serverState;
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
            this.state.queueExecution(testNote);
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

    async handleSummarize(note, step) {
        try {
            const result = await this.state.tools.executeTool('summarize', step.input, { graph: this.state.graph, llm: this.state.llm });
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
        this.state.writeNoteToDB(note);
        return `Tool execution failed: ${error.message}`;
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
        this.state.writeNoteToDB(note);
        return errorMsg;
    }
}
