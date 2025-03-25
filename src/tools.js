import {readdir} from 'node:fs/promises';

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

    async loadTools(path) {
        this.tools = new Map(); // Clear existing tools before reloading
        const files = await readdir(path);
        for (const file of files) {
            if (file.endsWith('.js')) { // Only load .js files
                await this._loadToolFromFile(path, file);
            }
        }
        return this.getTools();
    }

    async _loadToolFromFile(path, file) {
        try {
            const module = await import(`file://${process.cwd()}/${path}/${file}`);
            const toolDef = module.default;
            const tool = new Tool(toolDef);
            this.addTool(tool);
        } catch (e) {
            console.error(`Error loading tool ${file} from ${path}: ${e}`);
        }
    }

    addTool(tool) {
        this.tools.set(tool.name, tool);
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
