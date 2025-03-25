import {z} from 'zod';

const schema = z.object({
    noteId: z.string()
});

export default {
    name: 'debug',
    description: 'Output detailed debug information about a Note',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {noteId} = schema.parse(input);
        const note = context.graph.getNote(noteId);

        if (!note) {
            return `Error: Note with ID '${noteId}' not found.`;
        }

        const debugInfo = {
            id: note.id,
            title: note.title,
            type: note.content.type,
            status: note.status,
            priority: note.priority,
            deadline: note.deadline,
            logic: note.logic,
            memory: note.memory ? note.memory.length : 0,
            references: note.references ? note.references.length : 0,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            // Add any other relevant properties you want to debug
        };

        return JSON.stringify(debugInfo, null, 2);
    }
};
import { withToolHandling } from '../tool_utils.js';

async function invoke(input, context) {
    const {noteId} = schema.parse(input);
    const note = context.graph.getNote(noteId);

    if (!note) {
        return `Error: Note with ID '${noteId}' not found.`;
    }

    const debugInfo = {
        id: note.id,
        title: note.title,
        type: note.content.type,
        status: note.status,
        priority: note.priority,
        deadline: note.deadline,
        logic: note.logic,
        memory: note.memory ? note.memory.length : 0,
        references: note.references ? note.references.length : 0,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        // Add any other relevant properties you want to debug
    };

    return JSON.stringify(debugInfo, null, 2);
}

export default {
    name: 'debug',
    description: 'Output detailed debug information about a Note',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: withToolHandling({ name: 'debug', schema, invoke }),
};
