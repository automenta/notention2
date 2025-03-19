import { z } from 'zod';

const schema = z.object({
    noteId: z.string()
});

export default {
    name: 'debug',
    description: 'Debug state',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const { noteId } = schema.parse(input);
        const graph = context.graph;
        const note = graph.getNote(noteId);
        if (!note) return `Note ${noteId} not found`;
        return JSON.stringify({
            id: note.id,
            title: note.title,
            status: note.status,
            memory: note.memory,
            references: note.references,
        }, null, 2);
    }
};
