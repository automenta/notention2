import { logToolStart, logToolExecutionError } from './utils.js';
import {loadToolsFromDirectory} from './tool_utils.js';

export function withStandardToolHandling(context, toolName, note, step) {
    const augmentedContext = { ...context };

    augmentedContext.logToolStart = () => {
        logToolStart(context.state, note.id, step.id, toolName);
    };

    augmentedContext.handleToolError = (error) => {
        logToolExecutionError(context.state, note.id, step.id, toolName, error);
        throw error; // Re-throw for handling in NoteRunner
    };

    return augmentedContext;
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
        return {
            name,
            description,
            schema,
            version,
            dependencies,
            invoke
        };
    };
}

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
