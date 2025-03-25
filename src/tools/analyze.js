import {z} from 'zod';
import { withToolHandling, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    targetId: z.string()
});

const invoke = createSimpleInvoke(schema);

async function invokeImpl(input, context) { // Rename original invoke to invokeImpl
    const {targetId} = invoke(input); // Parse input here for consistency
    const note = context.graph.getNote(targetId);
    if (!note) return `Note ${targetId} not found`;
    return `Analyzing ${targetId}`;
}


export default {
    name: 'analyze',
    description: 'Analyze note performance',
    schema,
    invoke: withToolHandling({ name: 'analyze', schema, invoke: invokeImpl }), // Use invokeImpl in withToolHandling
};
