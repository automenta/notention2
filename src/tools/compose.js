import {z} from 'zod';

const schema = z.object({
    tools: z.array(z.string()),
    inputs: z.any()
});

export default {
    name: 'compose',
    description: 'Combine tools',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {tools: toolNames, inputs} = schema.parse(input);
        const graph = context.graph;
        let result = inputs;
        for (const toolName of toolNames) {
            const tool = graph.getNote(toolName);
            if (!tool) return `Tool ${toolName} not found`;
            result = await tool.invoke(result, context);
        }
        return result;
    }
};
