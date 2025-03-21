import { z } from 'zod';
import crypto from 'crypto';

const schema = z.object({
    noteId: z.string(),
    time: z.string()
});

export default {
    name: 'schedule',
    description: 'Schedule tasks',
    schema,
    async invoke(input, context) {
        const schemaExtended = z.object({
            noteId: z.string(),
            time: z.string(),
            collabIds: z.array(z.string()).optional(),
            scenario: z.string().optional()
        });
        const { noteId, time, collabIds = [], scenario } = schemaExtended.parse(input);
        const graph = context.graph;
        const note = graph.getNote(noteId);
        if (!note) return `Note ${noteId} not found`;
        note.deadline = time;
        note.status = 'pending';
        if (collabIds.length) {
            note.logic.push({ id: crypto.randomUUID(), tool: 'collaborate', input: { noteIds: collabIds }, status: 'pending' });
        }
        if (scenario) {
            const prediction = await context.llm.predictOutcome(noteId, scenario);
            note.memory.push({ type: 'prediction', content: prediction, timestamp: Date.now() });
        }
        return `Scheduled ${noteId} for ${time}${collabIds.length ? ` with collab` : ''}${scenario ? ` predicted` : ''}`;
    }
};
