import {z} from 'zod';
import { defineTool } from '../tool_utils.js';

const schema = z.object({
    startId: z.string(),
    query: z.string()
});

async function invoke(input, context) { // Rename original invoke to invokeImpl
    const { startId, query } = schema.parse(input); // Parse input here for consistency
    const graph = context.graph;
    const visited = new Set();
    const queue = [startId];
    const results = [];

    while (queue.length) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);

        const note = graph.getNote(id);
        if (note && (note.title.includes(query) || note.content.includes(query))) {
            results.push({ id, title: note.title });
        }
        queue.push(...graph.getReferences(id));
    }

    return results;
}

export default defineTool({
    name: 'graph_search',
    description: 'Search graph by query',
    schema,
    invoke: invoke,
});
