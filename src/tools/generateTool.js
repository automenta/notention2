import {z} from 'zod';
import { defineTool, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    name: z.string(),
    desc: z.string(),
    code: z.string()
});

const invokeImpl = createSimpleInvoke(schema);


export default defineTool({
    name: 'generateTool',
    description: 'Generate a new tool at runtime',
    schema,
    invoke: invokeImpl,
});
