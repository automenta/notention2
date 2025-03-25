import {z} from 'zod';
import { withToolHandling, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    title: z.string(),
    goal: z.string()
});

const invoke = createSimpleInvoke(schema);


export default {
    name: 'knowNote',
    description: 'Create a new note with a goal',
    schema,
    invoke: withToolHandling({ name: 'knowNote', schema, invoke })
};
