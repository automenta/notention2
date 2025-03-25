import {z} from 'zod';
import { defineTool } from '../tool_utils.js';
import {writeFile} from 'node:fs/promises';
import path from 'path';
import {CONFIG} from '../config.js';
import {Script} from 'node:vm'; // Import Script for code validation

async function validateCode(code) {
    try {
        new Script(code); // Will throw an error if code is invalid
        return { isValid: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { isValid: false, error: errorMessage };
    }
}

const schema = z.object({
    tool_definition: z.object({
        name: z.string(),
        description: z.string(),
        code: z.string(),
        schemaDef: z.string().optional(),
        dependencies: z.array(z.string()).optional()
    })
});

async function invoke(input, context) {
    const {tool_definition} = schema.parse(input);
    const {name, description, code, schemaDef, dependencies} = tool_definition;

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
        context.logger.log(`Validating tool code for '${name}'...`, 'debug', {
            component: 'implement_tool',
            toolName: name
        });
        const validationResult = await validateCode(toolCode);
        if (!validationResult.isValid) {
            const errorMsg = `Tool code validation error for '${name}': ${validationResult.error}`;
            console.error(errorMsg);
            context.logger.error(errorMsg, {
                component: 'implement_tool',
                toolName: name,
                errorType: 'CodeValidationError',
                errorMessage: validationResult.error,
                toolCodeSnippet: toolCode.substring(0, 200) + '...'
            });
            return {
                status: 'error',
                message: errorMsg,
                errorDetails: {
                    type: 'CodeValidationError',
                    errorMessage: validationResult.error,
                    toolCodeSnippet: toolCode.substring(0, 200) + '...'
                }
            };
        }
        context.logger.debug(`Tool code validated successfully for '${name}'.`, {
            component: 'implement_tool',
            toolName: name
        });

        await writeFile(filepath, toolCode);
        await context.state.toolLoader.loadTools(CONFIG.TOOLS_BUILTIN_DIR);

        const successMsg = `Tool '${name}' implemented, validated, and registered. Code written to '${filepath}'.`;
        context.logger.info(successMsg, {component: 'implement_tool', toolName: name, filepath: filepath});
        return {status: 'success', message: successMsg, filepath: filepath};

    } catch (error) { // Catch other errors during tool implementation (e.g., file write errors)
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorMsg = `Error implementing tool '${name}': ${errorMessage}`;
        console.error(errorMsg, error);
        context.logger.error(errorMsg, {
            component: 'implement_tool',
            toolName: name,
            errorType: 'ToolImplementationError',
            errorMessage: errorMessage,
            filepath: filepath
        });
        return {
            status: 'error',
            message: errorMsg,
            errorDetails: {
                type: 'ToolImplementationError',
                errorMessage: errorMessage,
                filepath: filepath
            }
        };
    }
}

export default defineTool({
    name: 'implement_tool',
    description: 'Implements a new tool with schema, dependencies, and code validation, writing to a file',
    schema,
    version: '1.3.0',
    dependencies: ['zod', 'fs', 'path', 'vm'],
    try {
        context.logToolStart();
        const {tool_definition} = schema.parse(input);
        const {name, description, code, schemaDef, dependencies} = tool_definition;

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
            context.logger.log(`Validating tool code for '${name}'...`, 'debug', {
                component: 'implement_tool',
                toolName: name
            });
            const validationResult = await validateCode(toolCode);
            if (!validationResult.isValid) {
                const errorMsg = `Tool code validation error for '${name}': ${validationResult.error}`;
                console.error(errorMsg);
                context.logger.error(errorMsg, {
                    component: 'implement_tool',
                    toolName: name,
                    errorType: 'CodeValidationError',
                    errorMessage: validationResult.error,
                    toolCodeSnippet: toolCode.substring(0, 200) + '...'
                });
                return {
                    status: 'error',
                    message: errorMsg,
                    errorDetails: {
                        type: 'CodeValidationError',
                        errorMessage: validationResult.error,
                        toolCodeSnippet: toolCode.substring(0, 200) + '...'
                    }
                };
            }
            context.logger.debug(`Tool code validated successfully for '${name}'.`, {
                component: 'implement_tool',
                toolName: name
            });

            await writeFile(filepath, toolCode);
            await context.state.toolLoader.loadTools(CONFIG.TOOLS_BUILTIN_DIR);

            const successMsg = `Tool '${name}' implemented, validated, and registered. Code written to '${filepath}'.`;
            context.logger.info(successMsg, {component: 'implement_tool', toolName: name, filepath: filepath});
            return {status: 'success', message: successMsg, filepath: filepath};

        } catch (error) { // Catch other errors during tool implementation (e.g., file write errors)
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorMsg = `Error implementing tool '${name}': ${errorMessage}`;
            console.error(errorMsg, error);
            context.logger.error(errorMsg, {
                component: 'implement_tool',
                toolName: name,
                errorType: 'ToolImplementationError',
                errorMessage: errorMessage,
                filepath: filepath
            });
            return {
                status: 'error',
                message: errorMsg,
                errorDetails: {
                    type: 'ToolImplementationError',
                    errorMessage: errorMessage,
                    filepath: filepath
                }
            };
        }
    } catch (error) {
        context.handleToolError(error);
    }
}

export default defineTool({
    name: 'implement_tool',
    description: 'Implements a new tool with schema, dependencies, and code validation, writing to a file',
    schema,
    version: '1.3.0',
    dependencies: ['zod', 'fs', 'path', 'vm'],
    invoke: invoke,
});
`;

        try {
            // --- Code Validation ---
            context.logger.log(`Validating tool code for '${name}'...`, 'debug', {
                component: 'implement_tool',
                toolName: name
            });
            const validationResult = await validateCode(toolCode);
            if (!validationResult.isValid) {
                const errorMsg = `Tool code validation error for '${name}': ${validationResult.error}`;
                console.error(errorMsg);
                context.logger.error(errorMsg, {
                    component: 'implement_tool',
                    toolName: name,
                    errorType: 'CodeValidationError',
                    errorMessage: validationResult.error,
                    toolCodeSnippet: toolCode.substring(0, 200) + '...'
                });
                return {
                    status: 'error',
                    message: errorMsg,
                    errorDetails: {
                        type: 'CodeValidationError',
                        errorMessage: validationResult.error,
                        toolCodeSnippet: toolCode.substring(0, 200) + '...'
                    }
                };
            }
            context.logger.debug(`Tool code validated successfully for '${name}'.`, {
                component: 'implement_tool',
                toolName: name
            });

            await writeFile(filepath, toolCode);
        await context.state.toolLoader.loadTools(CONFIG.TOOLS_BUILTIN_DIR);

            const successMsg = `Tool '${name}' implemented, validated, and registered. Code written to '${filepath}'.`;
            context.logger.info(successMsg, {component: 'implement_tool', toolName: name, filepath: filepath});
            return {status: 'success', message: successMsg, filepath: filepath};

        } catch (error) { // Catch other errors during tool implementation (e.g., file write errors)
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorMsg = `Error implementing tool '${name}': ${errorMessage}`;
            console.error(errorMsg, error);
            context.logger.error(errorMsg, {
                component: 'implement_tool',
                toolName: name,
                errorType: 'ToolImplementationError',
                errorMessage: errorMessage,
                filepath: filepath
            });
            return {
                status: 'error',
                message: errorMsg,
                errorDetails: {
                    type: 'ToolImplementationError',
                    errorMessage: errorMessage,
                    filepath: filepath
                }
            };
        }
    }
};
