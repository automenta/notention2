import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    noteId: z.string(),
    time: z.string() // You might want to use a more specific format for time/date
});

async function invoke(input, context) { // Rename original invoke to invokeImpl
    const {noteId, time} = schema.parse(input); // Parse input here for consistency
    const graph = context.graph;
    const note = graph.getNote(noteId);

    if (!note) {
        return `Error: Note with ID '${noteId}' not found.`;
    }

    const scheduledTime = new Date(time);
    if (isNaN(scheduledTime.getTime())) {
        return `Error: Invalid time format '${time}'. Please use a valid date and time string.`;
    }

    const delay = scheduledTime.getTime() - Date.now();

    if (delay <= 0) {
        return `Error: Scheduled time '${time}' is in the past.`;
    }

    context.logger.log(`Note '${noteId}' scheduling execution for '${time}'.`, 'info', {
        component: 'schedule',
        noteId: noteId,
        scheduledTime: time
    });

    setTimeout(async () => {
        note.status = 'pending';
        await context.serverCore.writeNoteToDB(note);
        context.state.queueManager.queueExecution(note);
        context.logger.log(`Note '${noteId}' executed as scheduled at '${time}'.`, 'info', {
            component: 'schedule',
            noteId: noteId,
            scheduledTime: time
        });
    }, delay);

    return `Note '${noteId}' scheduled to run at '${time}'.`;
}


export default defineTool({
    name: 'schedule',
    description: 'Schedule a Note to run at a specific time',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke,
});
