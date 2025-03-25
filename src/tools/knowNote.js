import {z} from 'zod';
import { withToolHandling } from '../tool_utils.js';

const schema = z.object({
    title: z.string(),
    goal: z.string()
});

async function invoke(input, context) {
        const {title, goal} = schema.parse(input);
        return {title, goal};
    }

export default {
    name: 'knowNote',
    description: 'Create a new note with a goal',
    schema,
    invoke: withToolHandling({ name: 'knowNote', schema, invoke }),
};
