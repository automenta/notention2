import {loadToolsFromDirectory} from './tool_utils.js';
import { Tool } from './tool_utils.js';

export class Tools {
    constructor() {
        this.tools = new Map();
    }

    addTool(toolDefinition) {
        const toolFactory = toolDefinition; // No need to instantiate here
        const tool = toolFactory();
        this.tools.set(tool.name, tool);
    }

    async loadTools(path) {
        this.tools = new Map(); // Clear existing tools before reloading
        await loadToolsFromDirectory(path, this.addTool.bind(this));
        return this.getTools();
    }

    getTool(name) {
        return this.tools.get(name);
    }

    hasTool(name) {
        return this.tools.has(name);
    }

    getTools() {
        return Array.from(this.tools.values());
    }
}
