import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

import {z} from 'zod';
import { withToolHandling } from '../tool_utils.js';
const schema = z.object({
    description: z.string(),
    execute: z.boolean().optional(),
});

async function invoke(input, context) {
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

export default {
    name: 'generateCode',
    description: 'Generate JS code',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'node:fs/promises', 'node:path', 'vm'],
    invoke: withToolHandling({ name: 'generateCode', schema, invoke }),
};
