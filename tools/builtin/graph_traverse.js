import { z } from 'zod';

const schema = z.object({
    startId: z.string(),
    mode: z.enum(['dfs', 'bfs']),
    callback: z.string()
});

export default {
    name: 'graph_traverse',
    description: 'Traverse graph (DFS/BFS)',
    schema,
    async invoke(input) {
        const { startId, mode, callback } = schema.parse(input);
        // Implement graph traversal logic here
        return `Graph traversal (${mode}) starting from ${startId} with callback ${callback} (Implementation Pending)`;
    },
};
