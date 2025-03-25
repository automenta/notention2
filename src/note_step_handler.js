import crypto from 'crypto';
import {z} from 'zod';
import {executeToolStep, handleToolStepError} from './tool_handler.js';

export class NoteStepHandler {
    errorHandler;

    constructor(serverState, errorHandler) {
        this.state = serverState;
        this.errorHandler = errorHandler;
    }

    async handleToolExecution(note, step, memoryMap, toolName) {
        try {
            const result = await executeToolStep(this.state, note, step, toolName, memoryMap, this.errorHandler);
            note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
            return result;
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
            return `Tool execution failed: ${error.message}`;
        }
    }

    async handleStep(note, step, memoryMap) {
        await this.handleToolExecution(note, step, memoryMap, step.tool);
    }

    async handleTestGeneration(note, step, memoryMap) {
        const {code, targetId} = step.input;
        const testCode = await this.handleToolExecution(note, step, memoryMap, 'test_gen');
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
    }

    async handleTestExecution(note, step, memoryMap) {
        const {testId} = step.input;
        return await this.handleToolExecution(note, step, memoryMap, 'test_run');
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
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleToolGeneration(note, step, memoryMap) {
        const {name, desc, code} = step.input;
        await this.handleToolExecution(note, step, memoryMap, 'generateTool');
    }

    async handleKnowNote(note, step, memoryMap) {
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
        await this.state.serverCore.writeNoteToDB(note);
        this.state.queueManager.queueExecution(newNote);
    }

    async handleAnalytics(note, step, memoryMap) {
        const {targetId} = step.input;
        return await this.handleToolExecution(note, step, memoryMap, 'analyze');
    }

    async handleFetchExternal(note, step, memoryMap) {
        const {apiName, query} = step.input;
        try {
            const data = await this.handleToolExecution(note, step, memoryMap, 'fetchExternal');
            note.memory.push({type: 'external', content: JSON.stringify(data), timestamp: Date.now(), stepId: step.id});
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
        }
    }

    async handleDefaultStep(note, step, memoryMap) {
        await this.handleToolExecution(note, step, memoryMap, step.tool);
    }
}
