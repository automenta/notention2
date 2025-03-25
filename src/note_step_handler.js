import crypto from 'crypto';
import { executeToolStep } from './tool_handler.js';

export class NoteStepHandler {
    constructor(serverState, errorHandler) {
        this.state = serverState;
        this.errorHandler = errorHandler;
    }

    async handleStep(note, step, memoryMap) {
        try {
            const result = await executeToolStep(this.state, note, step, step.tool, memoryMap, this.errorHandler);
            note.memory.push({ type: 'tool', content: result, timestamp: Date.now(), stepId: step.id });
            step.status = 'completed';
            await this.state.serverCore.writeNoteToDB(note);

            // Tool-specific post-processing
            switch (step.tool) {
                case 'test_gen':
                    await this.handleTestGeneration(note, step, result);
                    break;
                case 'knowNote':
                    await this.handleKnowNote(note, step, result);
                    break;
                case 'fetchExternal':
                    await this.handleFetchExternal(note, step, result);
                    break;
                case 'collaborate':
                    await this.handleCollaboration(note, step);
                    break;
                default:
                    break;
            }

            return result;
        } catch (error) {
            step.status = 'failed';
            this.errorHandler.handleToolStepError(note, step, error);
            throw error; // Re-throw to be caught by NoteRunner
        }
    }

    async handleTestGeneration(note, step, testCode) {
        const { targetId } = step.input;
        const testNoteId = crypto.randomUUID();
        const testNote = {
            id: testNoteId,
            title: `Test for ${targetId}`,
            content: { type: 'test', code: testCode },
            status: 'pending',
            priority: 75,
            references: [targetId],
            createdAt: new Date().toISOString()
        };
        const graph = this.state.getGraph();
        graph.addNote(testNote);
        note.memory.push({
            type: 'testGen',
            content: `Generated test ${testNoteId} for ${targetId}`,
            timestamp: Date.now(),
            stepId: step.id
        });
        this.state.queueManager.queueExecution(testNote);
    }

    async handleKnowNote(note, step, newNoteDetails) {
        const { title, goal } = step.input;
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
        const graph = this.state.getGraph();
        graph.addNote(newNote);
        note.memory.push({ type: 'know', content: `Knew ${newNoteId}`, timestamp: Date.now(), stepId: step.id });
        step.status = 'completed';
        await this.state.serverCore.writeNoteToDB(note);
        this.state.queueManager.queueExecution(newNote);
    }

    async handleFetchExternal(note, step, data) {
        const { apiName, query } = step.input;
        note.memory.push({ type: 'external', content: JSON.stringify(data), timestamp: Date.now(), stepId: step.id });
        step.status = 'completed';
        await this.state.serverCore.writeNoteToDB(note);
    }

    async handleCollaboration(note, step) {
        const { noteIds } = step.input;
        const llm = this.state.getLLM();
        const collabResult = await llm.invoke(
            [`Collaborate on "${note.title}" with notes: ${noteIds.join(', ')}`],
            noteIds
        );
        note.memory.push({ type: 'collab', content: collabResult.text, timestamp: Date.now(), stepId: step.id });
        step.status = 'completed';
        await this.state.serverCore.writeNoteToDB(note);
    }
}
