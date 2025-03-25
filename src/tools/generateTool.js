import {z} from 'zod';
import { withToolHandling, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    name: z.string(),
    desc: z.string(),
    code: z.string()
});

const invoke = createSimpleInvoke(schema);


export default {
    name: 'generateTool',
    description: 'Generate a new tool at runtime',
    schema,
    invoke: withToolHandling({ name: 'generateTool', schema, invoke })
};
