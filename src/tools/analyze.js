import {z} from 'zod';

const schema = z.object({
    targetId: z.string()
});

export default {
    name: 'analyze',
    description: 'Analyze note performance',
    schema,
    async invoke(input, context) {
        const {targetId} = schema.parse(input);
        const note = context.graph.getNote(targetId);
        if (!note) return `Note ${targetId} not found`;
        return `Analyzing ${targetId}`;
    }
};
