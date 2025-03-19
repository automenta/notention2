import { z } from 'zod';

const schema = z.object({
    startId: z.string(),
    query: z.string()
});

export default {
    name: 'graph_search',
    description: 'Search graph by query',
    schema,
    async invoke(input, context) {
        const { startId, query } = schema.parse(input);
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
};
