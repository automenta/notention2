import {readdir} from 'node:fs/promises';
import {join} from 'node:path';

export class Tool {
    constructor({name, description, schema, invoke, version = '1.0.0', dependencies = []}) {
        this.name = name;
        this.description = description;
        this.schema = schema;
        this.invoke = invoke;
        this.version = version;
        this.dependencies = dependencies;
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
            await this._loadToolFromFile(path, file);
        }
    }

    async _loadToolFromFile(path, file) {
        try {
            const {default: toolModule} = await import(`./${join(path, file)}`);
            const tool = new Tool(toolModule);
            this.tools.set(tool.name, tool);
        } catch (e) {
            console.error(`Error loading tool ${file} from ${path}: ${e}`);
            throw e;
        }
    }


    getTool(name) {
        return this.tools.get(name);
    }
}
