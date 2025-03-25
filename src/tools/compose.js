import {z} from 'zod';

const schema = z.object({
    toolChain: z.array(z.object({ // toolChain is now an array of tool configurations
        toolName: z.string(),
        input: z.any().optional() // Each tool in the chain can have its own input
    })),
});

export default {
    name: 'compose',
    description: 'Compose and execute a chain of tools',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {toolChain} = schema.parse(input);
        const executionResults = [];

        for (const toolConfig of toolChain) {
            const {toolName, input: stepInput} = toolConfig;
            const tool = context.tools.getTool(toolName);

            if (!tool) {
                return `Error: Tool '${toolName}' not found: ${toolName}`;
            }

            try {
                const result = await tool.execute(stepInput || {}, context); // Use stepInput if provided, otherwise empty object
                executionResults.push({ toolName, result });
            } catch (error) {
                return `Error executing tool '${toolName}': ${error.message}`;
            }
        }

        return executionResults; // Return results as an array of {toolName, result}
    }
};
