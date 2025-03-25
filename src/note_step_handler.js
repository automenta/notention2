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
            const stepResult = `Tool '${step.tool}' executed.`;
            note.memory.push({type: step.tool, content: result, timestamp: Date.now(), stepId: step.id});
            await this.state.markStepAsCompleted(note, step, stepResult);

            switch (step.tool) {
                case 'test_gen':
                    await this.handleTestGeneration(note, step, result);
                    break;
                case 'knowNote':
                    await this.handleKnowNote(note, step);
                    break;
                case 'fetchExternal':
                    await this.handleFetchExternal(note, step);
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
            throw error;
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

    async handleKnowNote(note, step) {
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
        const stepResult = `Knew ${newNoteId}`;
        note.memory.push({ type: 'know', content: stepResult, timestamp: Date.now(), stepId: step.id });
        await this.state.markStepAsCompleted(note, step, stepResult);
        this.state.queueManager.queueExecution(newNote);
    }

    async handleFetchExternal(note, step) {
        const { apiName, query } = step.input;
        const data = await this.state.getLLM().fetchExternalData(apiName, query);
        const stepResult = `Fetched data from ${apiName}`;
        note.memory.push({ type: 'external', content: JSON.stringify(data), timestamp: Date.now(), stepId: step.id });
        await this.state.markStepAsCompleted(note, step, stepResult);
    }

    async handleCollaboration(note, step) {
        const { noteIds } = step.input;
        const llm = this.state.getLLM();
        const collabResult = await llm.invoke(
            [`Collaborate on "${note.title}" with notes: ${noteIds.join(', ')}`],
            noteIds
        );
        const stepResult = `Collaborated with notes ${noteIds.join(', ')}`;
        note.memory.push({ type: 'collab', content: collabResult.text, timestamp: Date.now(), stepId: step.id });
        await this.state.markStepAsCompleted(note, step, stepResult);
    }
}
