import {readdir} from 'node:fs/promises';
import {Tool} from './tools.js';

export async function loadToolsFromDirectory(path, addTool) {
    const files = await readdir(path);
    for (const file of files) {
        if (file.endsWith('.js')) { // Only load .js files
            await loadToolFromFile(path, file, addTool);
        }
    }
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
