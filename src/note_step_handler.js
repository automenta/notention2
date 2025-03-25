import crypto from 'crypto';
import {z} from 'zod';
import {executeToolStep} from './tool_handler.js';

export class NoteStepHandler {
    errorHandler;

    constructor(serverState, errorHandler) {
        this.state = serverState;
        this.errorHandler = errorHandler;
    }

    async handleStep(note, step, memoryMap) {
        await executeToolStep(this.state, note, step, step.tool, memoryMap, this.errorHandler);
    }

    async handleTestGeneration(note, step, memoryMap) {
        const {code, targetId} = step.input;
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
    }

    async handleTestExecution(note, step, memoryMap) {
        const {testId} = step.input;
        return await executeToolStep(this.state, note, step, 'test_run', memoryMap, this.errorHandler);
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
            await handleToolStepError(this.state, note, step, error);
        }
    }

    async handleToolGeneration(note, step, memoryMap) {
        const {name, desc, code} = step.input;
        try {
            const toolDef = {
                name,
                description: desc,
                schema: z.object({}),
                invoke: new Function('input', 'context', code)
            };
            this.state.tools.addTool(toolDef);
            note.memory.push({
                type: 'toolGen',
                content: `Generated tool ${name}`,
                timestamp: Date.now(),
                stepId: step.id
            });
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);
        } catch (error) {
            await handleToolStepError(this.state, note, step, error);
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
            await handleToolStepError(this.state, note, step, error);
        }
    }

    async handleAnalytics(note, step, memoryMap) {
        const {targetId} = step.input;
        return await executeToolStep(this.state, note, step, 'analyze', memoryMap, this.errorHandler);
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

    async handleDefaultStep(note, step, memoryMap) {
        await executeToolStep(this.state, note, step, step.tool, memoryMap, this.errorHandler);
    }
}
