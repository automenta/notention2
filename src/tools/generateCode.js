import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const schema = z.object({
    description: z.string(),
    execute: z.boolean().optional(),
});

const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1});

export default {
    name: 'generateCode',
    description: 'Generate JS code',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'node:fs/promises', 'node:path', 'vm'],
    async invoke(input) {
        const {description, execute = false} = schema.parse(input);
        const code = await llm.invoke(`Generate JS code: ${description}`);
        if (execute) {
            const vm = require('vm');
            const sandbox = {console, require};
            vm.createContext(sandbox);
        }
import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const schema = z.object({
    description: z.string(),
    execute: z.boolean().optional(),
});

export default {
    name: 'generateCode',
    description: 'Generate JS code',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'node:fs/promises', 'node:path', 'vm'],
    async invoke(input) {
        const {description, execute = false} = schema.parse(input);
        const code = await llm.invoke(`Generate JS code: ${description}`);
        if (execute) {
            const vm = require('vm');
            const sandbox = {console, require};
            vm.createContext(sandbox);
        }
        return code.content;
    }
};
    name: 'generateCode',
    description: 'Generate JS code',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'node:fs/promises', 'node:path', 'vm'],
    async invoke(input) {
        const {description, execute = false} = schema.parse(input);
        const code = await llm.invoke(`Generate JS code: ${description}`);
        if (execute) {
            const vm = require('vm');
            const sandbox = {console, require};
            vm.createContext(sandbox);
        }
        return code.content;
    },
    handleStep // Export the handleStep function
};
