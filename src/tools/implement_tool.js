import {z} from 'zod';
import { Tool } from '../tools.js'; // Import Tool class

const schema = z.object({
    tool_definition: z.object({
        name: z.string(),
        description: z.string(),
        code: z.string() // Assume code is provided as a string for now
    })
});

export default {
    name: 'implement_tool',
    description: 'Implements a new tool and adds it to the tool registry',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const { tool_definition } = schema.parse(input);
        const { name, description, code } = tool_definition;

        if (!name || !description || !code) {
            return "Error: Tool definition must include name, description, and code.";
        }

        try {
            // Dynamically create a function from the provided code string
            const invokeFunction = new Function('input', 'context', code);

            const newToolDef = {
                name: name,
                description: description,
                schema: z.object({}), // Basic schema for now, can be enhanced
                invoke: invokeFunction
            };
            const newTool = new Tool(newToolDef);
            context.tools.addTool(newTool);

            const successMsg = `Tool '${name}' implemented and added to the tool registry.`;
            context.log(successMsg, 'info', { component: 'implement_tool', toolName: name });
            return successMsg;

        } catch (error) {
            const errorMsg = `Error implementing tool '${name}': ${error.message}`;
            console.error(errorMsg, error);
            context.log(errorMsg, 'error', { component: 'implement_tool', toolName: name, error: error.message });
            return errorMsg;
        }
    }
};
