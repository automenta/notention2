import {z} from 'zod';
import {createSimpleInvoke, defineTool} from '../tool_utils.js';

const schema = z.object({
    startId: z.string()
});

const invokeImpl = createSimpleInvoke(schema);

async function invoke(input, context) { // Rename original invoke to invokeImpl
    const {startId} = invokeImpl(input); // Parse input here for consistency
    const graph = context.graph;
    const note = graph.getNote(startId);

    if (!note) {
        return `Node ${startId} not found`;
    }

    const degree = graph.getReferences(startId).length;
    return {degree, nodes: graph.getSize()};
}


export default defineTool({
    name: 'graph_metrics',
    description: 'Compute graph metrics',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke,
});
