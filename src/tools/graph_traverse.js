import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    startId: z.string(),
    mode: z.enum(['dfs', 'bfs']).default('bfs'),
    callback: z.string().optional()
});

async function traverseGraph(graph, startId, mode) {
    const visited = new Set();
    const stackOrQueue = [startId];
    const results = [];

    while (stackOrQueue.length) {
        const id = mode === 'dfs' ? stackOrQueue.pop() : stackOrQueue.shift();
        if (visited.has(id)) continue;
        visited.add(id);

        const note = graph.getNote(id);
        if (note) {
            results.push({id, title: note.title});
            stackOrQueue.push(...graph.getReferences(id));
        }
    }

    return results;
}


async function invoke(input, context) { // Rename original invoke to invokeImpl
    const {startId, mode, callback} = schema.parse(input); // Parse input here for consistency
    const graph = context.graph;

    const results = await traverseGraph(graph, startId, mode);

    return `Traversed ${mode} from ${startId}, callback ${callback} applied: ${JSON.stringify(results)}`;
}


export default defineTool({
    name: 'graph_traverse',
    description: 'Traverse graph (DFS/BFS)',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke,
});
