import { z } from 'zod';

const schema = z.object({
    noteId: z.string()
});

export default {
    name: 'debug',
    description: 'Debug state',
    schema,
    async invoke(input) {
        const { noteId } = schema.parse(input);
        // Implement state debugging logic here
        return `Debugging state for ${noteId} (Implementation Pending)`;
    },
};
