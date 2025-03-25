import {z} from 'zod';
import { defineTool } from '../tool_utils.js';

const schema = z.object({
    query: z.string(),
    documents: z.array(z.string()).optional(),
    vectorStoreId: z.string().optional(),
});

async function invoke(input, context) {
    const { query, documents, vectorStoreId } = schema.parse(input);
    try {
        context.logToolStart();
        // Tool logic here, access context.llm, context.graph, etc.
        return `RAG Tool invoked with query: ${query}`; // Example return
    } catch (error) {
        context.handleToolError(error);
    }
}

export default defineTool({
    name: 'rag',
    description: 'Retrieval-Augmented Generation interface',
    schema,
    version: '1.0.0',
    dependencies: ['zod', '@langchain/core'],
    invoke: invoke,
});
