import {z} from 'zod';

const schema = z.object({
    apiName: z.string(),
    query: z.string()
});

export default {
    name: 'fetchExternal',
    description: 'Fetch data from an external API',
    schema,
    async invoke(input, context) {
        const {apiName, query} = schema.parse(input);
        return {apiName, query};
    }
};
import { withToolHandling } from '../tool_utils.js';

async function invoke(input, context) {
    const {apiName, query} = schema.parse(input);
    return {apiName, query};
}

export default {
    name: 'fetchExternal',
    description: 'Fetch data from an external API',
    schema,
    invoke: withToolHandling({ name: 'fetchExternal', schema, invoke }),
};
