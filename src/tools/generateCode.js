import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const schema = z.object({
    description: z.string(),
    execute: z.boolean().optional(),
});

//const llm = new ChatOpenAI({openAIApiKey: process.env.OPENAI_API_KEY});
const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1, maxRetries: 2});

export default {
    name: 'generateCode',
    description: 'Generate JS code',
    schema,
    async invoke(input) {
        const { description, execute = false } = schema.parse(input);
        const code = await llm.invoke(`Generate JS code: ${description}`);
        const fileName = `gen-${Date.now()}.js`;
        await writeFile(join('generated', fileName), code.content);
        if (execute) {
            const vm = require('vm');
            const sandbox = { console, require };
            vm.createContext(sandbox);
            vm.runInContext(code.content, sandbox);
        }
        return `Generated: ${fileName}`;
    },
};
