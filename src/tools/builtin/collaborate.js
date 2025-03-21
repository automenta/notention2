import { z } from 'zod';

const schema = z.object({
    noteIds: z.array(z.string())
});

export default {
    name: 'collaborate',
    description: 'Collaborate with other notes',
    schema,
    async invoke(input, context) {
        const { noteIds } = schema.parse(input);
        const notes = noteIds.map(id => context.graph.getNote(id)).filter(Boolean);
        if (!notes.length) return 'No valid notes found';
        const collabResult = await context.llm.invoke(
            [`Combine insights from: ${notes.map(n => n.title).join(', ')}`],
            noteIds
        );
        return collabResult.text;
    }
};
