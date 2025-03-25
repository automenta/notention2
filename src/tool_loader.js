import { logToolStart, logToolExecutionError } from './utils.js';
import {readdir} from 'node:fs/promises';

export function withToolHandling(tool) {
    return async (input, context) => {
        try {
            const validatedInput = tool.schema.parse(input);
            const result = await tool.invoke(validatedInput, context);
            return { success: true, data: result };
        } catch (error) {
            console.error(`Tool '${tool.name}' failed: ${error}`);
            return { success: false, error: error.message };
        }
    };
}

async function loadToolFromFile(path, file, addTool) {
    try {
        const module = await import(`file://${process.cwd()}/${path}/${file}`);
        const toolDef = module.default;
        const tool = new Tool(toolDef);
        addTool(tool);
    } catch (e) {
        console.error(`Error loading tool ${file} from ${path}: ${e}`);
    }
}

export function getToolSchema(availableTools, toolName) {
    const tool = availableTools.find(t => t.name === toolName);
    return tool?.schema;
}

export function defineTool({
    name,
    description,
    schema,
    invoke,
    version = '1.0.0',
    dependencies = [],
    logging = true // New option to control default logging
}) {
    return () => {
        const safeInvoke = async (input, context) => {
            try {
                const validatedInput = schema.parse(input);

                if (logging) {
                    logToolStart(context.state, context.note.id, context.step.id, name); // Log tool start
                }

                return await invoke(validatedInput, context);
            } catch (error) {
                console.error(`Input validation error for tool '${name}': ${error.errors}`);
                if (logging) {
                    logToolExecutionError(context.state, context.note.id, context.step.id, name, error); // Log tool error
                }
                throw new Error(`Tool input validation failed: ${error.errors.map(e => e.message).join(', ')}`);
            }
        };

        return {
            name,
            description,
            schema,
            version,
            dependencies,
            invoke: safeInvoke
        };
    };
}
