import {z} from 'zod';

const schema = z.object({
    query: z.string(),
    documents: z.array(z.string()).optional(),
    vectorStoreId: z.string().optional(),
});

async function invoke(input) {
        const {query} = schema.parse(input);
        return `Stub: RAG query: ${query}`;
    }

export default {
    name: 'rag',
    description: 'Retrieval-Augmented Generation interface',
    schema,
    version: '1.0.0',
    dependencies: ['zod', '@langchain/core'],
    invoke: withToolHandling({ name: 'rag', schema, invoke }),
};
