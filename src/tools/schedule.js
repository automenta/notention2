import {z} from 'zod';

const schema = z.object({
    noteId: z.string(),
    time: z.string() // You might want to use a more specific format for time/date
});

export default {
    name: 'schedule',
    description: 'Schedule a Note to run at a specific time',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {noteId, time} = schema.parse(input);
        const note = context.graph.getNote(noteId);

        if (!note) {
            return `Error: Note with ID '${noteId}' not found.`;
        }

        // Basic scheduling logic - in a real system, you'd use a more robust scheduler
        const scheduledTime = new Date(time);
        const delay = scheduledTime.getTime() - Date.now();

        if (delay <= 0) {
            return `Error: Scheduled time '${time}' is in the past.`;
        }

        setTimeout(() => {
            note.status = 'pending'; // Set note status to pending to be picked up by scheduler
            context.graph.writeNoteToDB(note); // Assuming writeNoteToDB is available in context
            console.log(`Note '${noteId}' executed as scheduled at '${time}'.`);
        }, delay);

        return `Note '${noteId}' scheduled to run at '${time}'.`;
    }
};
