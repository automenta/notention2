import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    targetId: z.string()
});

async function invoke(input, context) { // Rename original invoke to invokeImpl
    const {targetId} = schema.parse(input); // Parse input here for consistency
    try {
        context.logToolStart();
        return `Analyzing ${targetId}`;
    } catch (error) {
        context.handleToolError(error);
    }
}


export default defineTool({
    name: 'analyze',
    description: 'Analyze note performance',
    schema,
    invoke: invoke,
});
