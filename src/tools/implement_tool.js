import {z} from 'zod';
import { Tool } from '../tools.js'; // Import Tool class
import { writeFile } from 'node:fs/promises';
import path from 'path';
import { CONFIG } from '../config.js'; // Import CONFIG

const schema = z.object({
    tool_definition: z.object({
        name: z.string(),
        description: z.string(),
        code: z.string()
    })
});

export default {
    name: 'implement_tool',
    description: 'Implements a new tool and adds it to the tool registry by writing code to a file',
    schema,
    version: '1.1.0', // Version bump to indicate file writing capability
    dependencies: ['zod', 'fs', 'path'],
    async invoke(input, context) {
        const { tool_definition } = schema.parse(input);
        const { name, description, code } = tool_definition;

        if (!name || !description || !code) {
            return "Error: Tool definition must include name, description, and code.";
        }

        const filename = `${name}.js`;
        const filepath = path.join(CONFIG.TOOLS_BUILTIN_DIR, filename); // Use CONFIG.TOOLS_BUILTIN_DIR

        const toolCode = `
import { z } from 'zod';

const schema = z.object({}); // Default empty schema, can be enhanced

export default {
    name: '${name}',
    description: '${description}',
    schema,
    version: '1.0.0',
    async invoke(input, context) {
        ${code}
    }
};
`;

        try {
            await writeFile(filepath, toolCode);
            await context.state.tools.loadTools(CONFIG.TOOLS_BUILTIN_DIR); // Reload tools after writing new tool

            const successMsg = `Tool '${name}' implemented and registered. Code written to '${filepath}'.`;
            context.log(successMsg, 'info', { component: 'implement_tool', toolName: name, filepath: filepath });
            return successMsg;


        } catch (error) {
            const errorMsg = `Error implementing tool '${name}': ${error.message}`;
            console.error(errorMsg, error);
            context.log(errorMsg, 'error', { component: 'implement_tool', toolName: name, error: error.message, filepath: filepath });
            return errorMsg;
        }
    }
};
