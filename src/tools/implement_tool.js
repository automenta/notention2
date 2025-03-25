import {z} from 'zod';
import { Tool } from '../tools.js';
import { writeFile } from 'node:fs/promises';
import path from 'path';
import { CONFIG } from '../config.js';
import { Script } from 'node:vm'; // Import Script for code validation

const schema = z.object({
    tool_definition: z.object({
        name: z.string(),
        description: z.string(),
        code: z.string(),
        schemaDef: z.string().optional(),
        dependencies: z.array(z.string()).optional()
    })
});

export default {
    name: 'implement_tool',
    description: 'Implements a new tool with schema, dependencies, and code validation, writing to a file',
    schema,
    version: '1.3.0', // Version bump for code validation
    dependencies: ['zod', 'fs', 'path', 'vm'],
    async invoke(input, context) {
        const { tool_definition } = schema.parse(input);
        const { name, description, code, schemaDef, dependencies } = tool_definition;

        if (!name || !description || !code) {
            return "Error: Tool definition must include name, description, and code.";
        }

        const filename = `${name}.js`;
        const filepath = path.join(CONFIG.TOOLS_BUILTIN_DIR, filename);

        const parsedSchemaDef = schemaDef ? schemaDef.trim() : '{}';
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
            // --- Code Validation ---
            new Script(toolCode); // Will throw an error if code is invalid
            context.log(`Tool code validated successfully for '${name}'.`, 'debug', { component: 'implement_tool', toolName: name });

            await writeFile(filepath, toolCode);
            await context.state.tools.loadTools(CONFIG.TOOLS_BUILTIN_DIR);

            const successMsg = `Tool '${name}' implemented, validated, and registered. Code written to '${filepath}'.`;
            context.log(successMsg, 'info', { component: 'implement_tool', toolName: name, filepath: filepath });
            return successMsg;


        } catch (validationError) { // Catch code validation errors
            const errorMsg = `Tool code validation error for '${name}': ${validationError.message}`;
            console.error(errorMsg, validationError);
            context.log(errorMsg, 'error', { component: 'implement_tool', toolName: name, error: validationError.message, toolCodeSnippet: toolCode.substring(0, 200) + '...' }); // Log code snippet
            return errorMsg;


        } catch (error) { // Catch other errors (e.g., file write errors)
            const errorMsg = `Error implementing tool '${name}': ${error.message}`;
            console.error(errorMsg, error);
            context.log(errorMsg, 'error', { component: 'implement_tool', toolName: name, error: error.message, filepath: filepath });
            return errorMsg;
        }
    }
};
