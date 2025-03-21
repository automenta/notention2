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
