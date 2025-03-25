import {z} from 'zod';

const schema = z.object({
    tools: z.array(z.string()), // Array of tool names to compose
    inputs: z.any() // Initial input for the first tool in the chain
});

export default {
    name: 'compose',
    description: 'Compose and execute a chain of tools',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {tools: toolNames, inputs} = schema.parse(input);
        let currentInput = inputs;
        let stepInput = inputs.initialInput; // Use initialInput from inputs for the first step
        const executionResults = [];

        for (const toolName of toolNames) {
            const tool = context.tools.getTool(toolName);
            if (!tool) {
                return `Error: Tool '${toolName}' not found: ${toolName}`;
            }

            try {
                const result = await tool.execute(stepInput, context);
                executionResults.push({toolName, result});
                stepInput = result; // Output of current tool becomes input for the next
            } catch (error) {
                return `Error executing tool '${toolName}': ${error.message}`;
            }
        }

        return stepInput; // Return the final result of the chain
    }
};
