import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    noteIds: z.array(z.string())
});

async function invoke(input, context) {
    const {noteIds} = schema.parse(input);
    const graph = context.graph;
    const notes = noteIds.map(id => graph.getNote(id)).filter(Boolean);
    if (!notes.length) return 'No valid notes found';
    const llm = context.llm;
    const collabResult = await llm.invoke(
        [`Combine insights from: ${notes.map(n => n.title).join(', ')}`],
        noteIds
    );
    return collabResult.text;
}

export default defineTool({
    name: 'collaborate',
    description: 'Collaborate with other notes',
    schema,
    invoke: invoke,
});
