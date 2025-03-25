import {z} from 'zod';
import { Tool } from '../tools.js';
import { writeFile } from 'node:fs/promises';
import path from 'path';
import { CONFIG } from '../config.js';

const schema = z.object({
    tool_definition: z.object({
        name: z.string(),
        description: z.string(),
        code: z.string(),
        schemaDef: z.string().optional(), // Schema definition as string
        dependencies: z.array(z.string()).optional() // Dependencies as array of strings
    })
});

export default {
    name: 'implement_tool',
    description: 'Implements a new tool with schema and dependencies, and adds it to the tool registry by writing code to a file',
    schema,
    version: '1.2.0', // Version bump for schema and dependencies
    dependencies: ['zod', 'fs', 'path'],
    async invoke(input, context) {
        const { tool_definition } = schema.parse(input);
        const { name, description, code, schemaDef, dependencies } = tool_definition;

        if (!name || !description || !code) {
            return "Error: Tool definition must include name, description, and code.";
        }

        const filename = `${name}.js`;
        const filepath = path.join(CONFIG.TOOLS_BUILTIN_DIR, filename);

        // Construct schema from schemaDef string, default to empty schema if not provided
        const parsedSchemaDef = schemaDef ? schemaDef.trim() : '{}'; // Handle empty schemaDef
        const schemaCode = `const schema = z.object(${parsedSchemaDef});`;

        const toolCode = `
import { z } from 'zod';
${schemaCode}

export default {
    name: '${name}',
    description: '${description}',
    schema,
    version: '1.0.0',
    dependencies: ${JSON.stringify(dependencies || [])},
    async invoke(input, context) {
        ${code}
    }
};
`;

        try {
            await writeFile(filepath, toolCode);
            await context.state.tools.loadTools(CONFIG.TOOLS_BUILTIN_DIR);

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
