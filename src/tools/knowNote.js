import {z} from 'zod';

const schema = z.object({
    title: z.string(),
    goal: z.string()
});

export default {
    name: 'knowNote',
    description: 'Create a new note with a goal',
    schema,
    async invoke(input, context) {
        const {title, goal} = schema.parse(input);
        return {title, goal};
    }
};
import { withToolHandling } from '../tool_utils.js';

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
