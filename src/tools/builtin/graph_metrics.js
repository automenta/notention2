import { z } from 'zod';

const schema = z.object({
    startId: z.string()
});

export default {
    name: 'graph_metrics',
    description: 'Compute graph metrics',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const { startId } = schema.parse(input);
        const graph = context.graph;
        const note = graph.getNote(startId);
        if (!note) return `Node ${startId} not found`;
        const degree = graph.getReferences(startId).length;
        return { degree, nodes: graph.getSize() };
    }
};
