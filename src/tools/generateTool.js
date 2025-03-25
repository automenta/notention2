import {z} from 'zod';

const schema = z.object({
    name: z.string(),
    desc: z.string(),
import {z} from 'zod';
import { withToolHandling } from '../tool_utils.js';

const schema = z.object({
    name: z.string(),
    desc: z.string(),
    code: z.string()
});

async function invoke(input, context) {
    const {name, desc, code} = schema.parse(input);
    return {name, desc, code};
}

export default {
    name: 'generateTool',
    description: 'Generate a new tool at runtime',
    schema,
    invoke: withToolHandling({ name: 'generateTool', schema, invoke }),
};
