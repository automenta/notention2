import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    async loadTools(path) {
        const files = await readdir(path);
        for (const file of files) {
            try {
                const { default: tool } = await import(`file://${join(path, file)}`);
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
