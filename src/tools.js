import {readdir} from 'node:fs/promises';
import {join} from 'node:path';

// Define a formal Tool interface
export class Tool {
    constructor({name, description, schema, invoke, version = '1.0.0', dependencies = []}) {
        this.name = name;              // Unique identifier
        this.description = description; // Human-readable purpose
        this.schema = schema;          // Input validation (Zod schema)
        this.invoke = invoke;          // Async function to execute
        this.version = version;        // Tool version for tracking updates
        this.dependencies = dependencies; // Optional list of required tools or modules
    }

    async execute(input) {
        const validatedInput = this.schema.parse(input);
        return await this.invoke(validatedInput);
    }
}

export class Tools {
    constructor() {
        this.tools = new Map();
    }

    async loadTools(path) {
        const files = await readdir(path);
        for (const file of files) {
            try {
                const {default: toolModule} = await import(`file://${join(path, file)}`);
                const tool = new Tool(toolModule);
                this.tools.set(tool.name, tool);
            } catch (e) {
                console.error(`Error loading tool ${file} from ${path}: ${e}`);
            }
        }
    }

    getTool(name) {
        return this.tools.get(name);
    }
}
