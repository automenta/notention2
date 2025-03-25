import {z} from 'zod';
import { defineTool } from '../tool_utils.js';

const schema = z.object({
    title: z.string(),
    goal: z.string()
});

async function invoke(input, context) {
    const { title, goal } = schema.parse(input);
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
    const graph = context.graph;
    graph.addNote(newNote);
    note.memory.push({ type: 'know', content: `Knew ${newNoteId}`, timestamp: Date.now(), stepId: step.id });
    step.status = 'completed';
    await context.serverCore.writeNoteToDB(note);
    context.state.queueManager.queueExecution(newNote);
}


export default defineTool({
    name: 'knowNote',
    description: 'Create a new note with a goal',
    schema,
    invoke: invoke,
});
