import {z} from 'zod';

const schema = z.object({
    tools: z.array(z.string()),
    inputs: z.any()
});

export default {
    name: 'compose',
    description: 'Combine tools',
    schema,
    async invoke(input) {
        const {tools: toolNames, inputs} = schema.parse(input);
        const tools = await import('../../server.js').then(m => m.tools);
        let result = inputs;
        for (const toolName of toolNames) {
            const tool = tools.get(toolName);
            if (!tool) return `Tool ${toolName} not found`;
            result = await tool.invoke(result);
        }
        return result;
    }
};
