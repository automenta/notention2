import {z} from 'zod';

const schema = z.object({
    startId: z.string(),
    query: z.string()
});

export default {
    name: 'graph_search',
    description: 'Search graph by query',
    schema,
    async invoke(input) {
        const {startId, query} = schema.parse(input);
        const notes = await import('../../server.js').then(m => m.notes);
        const visited = new Set();
        const queue = [startId];
        const results = [];
        while (queue.length) {
            const id = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            const note = notes.get(id);
            if (note && (note.title.includes(query) || note.content.includes(query))) {
                results.push({id, title: note.title});
            }
            queue.push(...(note.references || []));
        }
        return results;
    }
};
