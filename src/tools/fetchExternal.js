import {z} from 'zod';
import { withToolHandling, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    apiName: z.string(),
    query: z.string()
});

const invoke = createSimpleInvoke(schema);


export default {
    name: 'fetchExternal',
    description: 'Fetch data from an external API',
    schema,
    invoke: withToolHandling({ name: 'fetchExternal', schema, invoke })
};
