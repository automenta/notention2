import {readdir} from 'node:fs/promises';
import { Tool } from './tools.js';
import { CONFIG } from './config.js';

export class ToolLoader {
    constructor(serverState) {
        this.state = serverState;
    }

    async loadTools() {
        this.state.tools = new Map(); // Clear existing tools before reloading
        const files = await readdir(CONFIG.TOOLS_BUILTIN_DIR);
        for (const file of files) {
            if (file.endsWith('.js')) { // Only load .js files
                await this._loadToolFromFile(CONFIG.TOOLS_BUILTIN_DIR, file);
            }
        }
        return this.state.tools.getTools();
    }

    async _loadToolFromFile(path, file) {
        try {
            const module = await import(`file://${process.cwd()}/${path}/${file}`);
            const toolDef = module.default;
            const tool = new Tool(toolDef);
            this.state.tools.addTool(tool);
        } catch (e) {
            console.error(`Error loading tool ${file} from ${path}: ${e}`);
        }
    }
}
