import {z} from 'zod';
import { defineTool } from '../tool_utils.js';

const schema = z.object({
    noteId: z.string()
});

async function invoke(input, context) {
    const { noteId } = schema.parse(input);
    const graph = context.graph;
    const note = graph.getNote(noteId);

    if (!note) {
        return `Note with ID '${noteId}' not found.`;
    }

    const llm = context.llm;
    const noteSummary = await llm.invoke([
        {
            role: 'user',
            content: `Summarize the following note for reflection:
                Title: ${note.title}
                Content: ${JSON.stringify(note.content, null, 2)}
                Logic: ${JSON.stringify(note.logic, null, 2)}`
        }
    ]);

    return `Reflection on Note '${note.title}' (ID: ${noteId}):\n${noteSummary.text}`;
}

export default defineTool({
    name: 'reflect',
    description: 'Reflect on a note and summarize its content and logic',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke,
})()
