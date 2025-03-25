import {z} from 'zod';

const schema = z.object({
    targetId: z.string()
});

async function invoke(input, context) {
    const {targetId} = schema.parse(input);
    const note = context.graph.getNote(targetId);
    if (!note) return `Note ${targetId} not found`;
    return `Analyzing ${targetId}`;
}

export default {
    name: 'analyze',
    description: 'Analyze note performance',
    schema,
    invoke: withToolHandling({ name: 'analyze', schema, invoke }),
};
