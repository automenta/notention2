import {readdir} from 'node:fs/promises';
import {Tool} from './tools.js';

export async function loadToolsFromDirectory(path, addTool) {
    const files = await readdir(path);
    for (const file of files) {
        if (file.endsWith('.js')) {
            await loadToolFromFile(path, file, addTool);
        }
    }
}

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

export function createSimpleInvoke(schema) {
    return async function invoke(input) {
        const parsedInput = schema.parse(input);
        return parsedInput;
    };
}
