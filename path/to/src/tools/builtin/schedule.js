import {z} from 'zod';

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
    async invoke(input) {
        const {noteId, time} = schema.parse(input);
        const notes = await import('../../server.js').then(m => m.notes);
        const note = notes.get(noteId);
        if (!note) return `Note ${noteId} not found`;
        note.deadline = time;
        note.status = 'pending';
        setTimeout(async () => {
            note.status = 'running';
            await import('../../server.js').then(m => m.runNote(noteId));
        }, new Date(time) - Date.now());
        await import('../../server.js').then(m => m.writeFile(join(m.NOTES_DIR, `${noteId}.json`), JSON.stringify(note)));
        return `Scheduled ${noteId} for ${time}`;
    }
};
