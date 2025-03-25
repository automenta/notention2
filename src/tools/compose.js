import {z} from 'zod';

const schema = z.object({
    dependencyGraph: z.record(z.array(z.string())),
    toolInputs: z.record(z.any()) // Inputs for each tool, keyed by tool name
});

export default {
    name: 'compose',
    description: 'Compose and execute a chain of tools',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {dependencyGraph, toolInputs} = schema.parse(input);
        const executionResults = {};
        const completedTools = new Set();
        const toolNames = Object.keys(dependencyGraph);
        const toolsToExecute = [...toolNames];

        while (toolsToExecute.length > 0) {
            let executedToolInThisIteration = false; // Track if any tool was executed

            for (let i = 0; i < toolsToExecute.length; i++) {
                const toolName = toolsToExecute[i];
                if (completedTools.has(toolName)) continue; // Skip if already completed

                const dependencies = dependencyGraph[toolName] || [];
                const allDependenciesMet = dependencies.every(dep => completedTools.has(dep));

                if (allDependenciesMet) {
                    const tool = context.tools.getTool(toolName);
                    if (!tool) {
                        return `Error: Tool '${toolName}' not found: ${toolName}`;
                    }

                    try {
                        const stepInput = toolInputs[toolName] || {}; // Get specific input for this tool
                        const result = await tool.execute(stepInput, context);
                        executionResults[toolName] = result;
                        completedTools.add(toolName);
                        toolsToExecute.splice(i, 1);
                        i--; // Adjust index after splice
                        executedToolInThisIteration = true; // Mark tool execution in this iteration
                        break; // Break to restart the loop from the beginning of toolsToExecute
                    } catch (error) {
                        return `Error executing tool '${toolName}': ${error.message}`;
                    }
                }
            }
            if (!executedToolInThisIteration && toolsToExecute.length > 0) {
                return `Error: Dependency cycle detected or unmet dependencies for tools: ${toolsToExecute.join(', ')}. Check your dependency graph.`;
            }
        }

        return executionResults; // Return results as an object keyed by tool names
    }
};
