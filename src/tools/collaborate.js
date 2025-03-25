import {z} from 'zod';

const schema = z.object({
    noteIds: z.array(z.string())
});

export default {
    name: 'collaborate',
    description: 'Collaborate with other notes',
    schema,
    async invoke(input, context) {
        const { noteIds } = schema.parse(input);
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
};
