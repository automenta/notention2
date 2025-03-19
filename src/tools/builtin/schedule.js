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
            // await import('../../server.js').then(m => m.runNote(noteId)); // This is incorrect
            // Instead, trigger the server to run the note.  The best way to do this is likely
            // to send a message to the server via the websocket.  For now, we'll just leave
            // this as a stub.
            console.log(`Scheduled note ${noteId} is now running (simulated).`);
        }, new Date(time) - Date.now());
        // await import('../../server.js').then(m => m.writeFile(join(m.NOTES_DIR, `${noteId}.json`), JSON.stringify(note))); // Incorrect
        return `Scheduled ${noteId} for ${time}`;
    }
};
