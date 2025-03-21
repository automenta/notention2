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

    async execute(input, context) { // Added context
        const validatedInput = this.schema.parse(input);
        return await this.invoke(validatedInput, context); // Pass context to invoke
    }
}

export class Tools {
    constructor() {
        this.tools = new Map();
    }

    async loadTools(path) {
        const files = await readdir(path);
        for (const file of files) {
            await this._loadToolFromFile(path, file);
        }
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
