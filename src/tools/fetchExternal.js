import {z} from 'zod';
import { defineTool } from '../tool_utils.js';

const schema = z.object({
    apiName: z.string(),
    query: z.string()
});

async function invoke(input, context) {
    const { apiName, query } = schema.parse(input);
    const llm = context.llm;
    const data = await llm.fetchExternalData(apiName, query);
    return data;
}


export default defineTool({
    name: 'fetchExternal',
    description: 'Fetch data from an external API',
    schema,
    invoke: invoke
});
