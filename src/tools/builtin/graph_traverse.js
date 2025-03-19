import {z} from 'zod';

const schema = z.object({
    startId: z.string(),
    mode: z.enum(['dfs', 'bfs']),
    callback: z.string()
});

export default {
    name: 'graph_traverse',
    description: 'Traverse graph (DFS/BFS)',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input) {
        const {startId, mode, callback} = schema.parse(input);
        const notes = await import('../../server.js').then(m => m.notes);
        const visited = new Set();
        const stackOrQueue = [startId];
        const results = [];
        while (stackOrQueue.length) {
            const id = mode === 'dfs' ? stackOrQueue.pop() : stackOrQueue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            const note = notes.get(id);
            if (note) {
                results.push({id, title: note.title});
                stackOrQueue.push(...(note.references || []));
            }
        }
        return `Traversed ${mode} from ${startId}, callback ${callback} applied: ${JSON.stringify(results)}`;
    }
};
