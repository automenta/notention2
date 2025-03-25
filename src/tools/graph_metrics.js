import {z} from 'zod';
import { withToolHandling, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    startId: z.string()
});

const invoke = createSimpleInvoke(schema);

async function invokeImpl(input, context) { // Rename original invoke to invokeImpl
    const {startId} = invoke(input); // Parse input here for consistency
    const graph = context.graph;
    const note = graph.getNote(startId);

    if (!note) {
        return `Node ${startId} not found`;
    }

    const degree = graph.getReferences(startId).length;
    return {degree, nodes: graph.getSize()};
}


export default {
    name: 'graph_metrics',
    description: 'Compute graph metrics',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: withToolHandling({ name: 'graph_metrics', schema, invoke: invokeImpl }), // Use invokeImpl in withToolHandling
};
