import {z} from 'zod';

const schema = z.object({
    startId: z.string()
});

export default {
    name: 'graph_metrics',
    description: 'Compute graph metrics',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input) {
        const {startId} = schema.parse(input);
        const notes = await import('../../server.js').then(m => m.notes);
        const note = notes.get(startId);
        if (!note) return `Node ${startId} not found`;
        const degree = note.references.length;
        return {degree, nodes: notes.size};
    }
};
