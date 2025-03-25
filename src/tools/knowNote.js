import {z} from 'zod';
import { defineTool, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    title: z.string(),
    goal: z.string()
});

const invokeImpl = createSimpleInvoke(schema);


export default defineTool({
    name: 'knowNote',
    description: 'Create a new note with a goal',
    schema,
    invoke: invokeImpl,
});
