import {z} from 'zod';
import { defineTool, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    query: z.string(),
    documents: z.array(z.string()).optional(),
    vectorStoreId: z.string().optional(),
});

const invokeImpl = createSimpleInvoke(schema);

export default defineTool({
    name: 'rag',
    description: 'Retrieval-Augmented Generation interface',
    schema,
    version: '1.0.0',
    dependencies: ['zod', '@langchain/core'],
    invoke: invokeImpl,
});
