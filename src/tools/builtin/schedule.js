import { z } from 'zod';

const schema = z.object({
    noteId: z.string(),
    time: z.string()
});

export default {
    name: 'schedule',
    description: 'Schedule tasks',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const { noteId, time } = schema.parse(input);
        const graph = context.graph;
        const note = graph.getNote(noteId);
        if (!note) return `Note ${noteId} not found`;
        note.deadline = time;
        note.status = 'pending';
        setTimeout(async () => {
            note.status = 'running';
            console.log(`Scheduled note ${noteId} is now running (simulated).`);
        }, new Date(time) - Date.now());
        return `Scheduled ${noteId} for ${time}`;
    }
};
