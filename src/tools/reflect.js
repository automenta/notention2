import {z} from 'zod';

const schema = z.object({
    noteId: z.string()
});

export default {
    name: 'reflect',
    description: 'Reflect on a note and summarize its content and logic',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {noteId} = schema.parse(input);
        const note = context.graph.getNote(noteId);

        if (!note) {
            return `Note with ID '${noteId}' not found.`;
        }

        const noteSummary = await context.llm.invoke([
            {
                role: 'user',
                content: `Summarize the following note for reflection:
                Title: ${note.title}
                Content: ${JSON.stringify(note.content, null, 2)}
import {z} from 'zod';

const schema = z.object({
    noteId: z.string()
});

async function handleStep(note, step, context) {
    try {
        const result = await context.tools.executeTool('reflect', step.input, {
            graph: context.graph,
            llm: context.llm
        });
        note.memory.push({type: 'reflect', content: result, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await context.state.writeNoteToDB(note);
    } catch (error) {
        context.errorHandler.handleToolStepError(note, step, error); // Use ErrorHandler
    }
}

export default {
    name: 'reflect',
    description: 'Reflect on a note and summarize its content and logic',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {noteId} = schema.parse(input);
        const note = context.graph.getNote(noteId);

        if (!note) {
            return `Note with ID '${noteId}' not found.`;
        }

        const noteSummary = await context.llm.invoke([
            {
                role: 'user',
                content: `Summarize the following note for reflection:
                Title: ${note.title}
                Content: ${JSON.stringify(note.content, null, 2)}
                Logic: ${JSON.stringify(note.logic, null, 2)}`
            }
        ]);

        return `Reflection on Note '${note.title}' (ID: ${noteId}):\n${noteSummary.text}`;
    },
    handleStep // Export the handleStep function
};
