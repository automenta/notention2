import {z} from 'zod';
import { defineTool } from '../tool_utils.js';

const schema = z.object({
    targetId: z.string()
});

async function invoke(input, context) { // Rename original invoke to invokeImpl
    const {targetId} = schema.parse(input); // Parse input here for consistency
    const note = context.graph.getNote(targetId);
    if (!note) return `Note ${targetId} not found`;
    return `Analyzing ${targetId}`;
}


export default defineTool({
    name: 'analyze',
    description: 'Analyze note performance',
    schema,
    invoke: invoke,
});
