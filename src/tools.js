import {loadToolsFromDirectory} from './tool_utils.js';

export class Tool {
    constructor({name, description, schema, invoke, version = '1.0.0', dependencies = []}) {
        this.name = name;
        this.description = description;
        this.schema = schema;
        this.invoke = invoke;
        this.version = version;
        this.dependencies = dependencies;
    }

    async execute(input, context) {
        try {
            const validatedInput = this.schema.parse(input);
            return await this.invoke(validatedInput, context); // Pass context to invoke
        } catch (error) {
            console.error(`Input validation error for tool '${this.name}': ${error.errors}`);
            throw new Error(`Tool input validation failed: ${error.errors.map(e => e.message).join(', ')}`);
        }
    }
}

export class Tools {
    constructor() {
        this.tools = new Map();
    }

    addTool(tool) {
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
