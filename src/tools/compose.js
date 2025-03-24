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
        const toolRegistry = context.tools;
        let result = inputs;
        const results = []; // Store results of each tool execution
        for (const toolName of toolNames) {
            if (!toolRegistry.hasTool(toolName)) {
                return `Tool ${toolName} not found`;
            }
            const tool = toolRegistry.getTool(toolName);
            result = await tool.execute(result, context);
            results.push({tool: toolName, result}); // Store tool name and result
        }
        return JSON.stringify(results, null, 2); // Return JSON string of all results
    }
};
