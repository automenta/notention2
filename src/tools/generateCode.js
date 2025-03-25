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
    async invoke(input, context) {
        const { description, execute = false } = input;
        const llm = context.llm;
        const code = await llm.invoke([`Generate JS code: ${description}`]);
        if (execute) {
            const vm = require('vm');
            const sandbox = { console, require };
            vm.createContext(sandbox);
        }
        return code.content;
    }
};
