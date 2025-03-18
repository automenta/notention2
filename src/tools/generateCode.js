import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const schema = z.object({description: z.string()});

//const llm = new ChatOpenAI({openAIApiKey: process.env.OPENAI_API_KEY});
const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1, maxRetries: 2});

export default {
    name: 'generateCode',
    description: 'Generate JS code',
    schema,
    async invoke(input) {
        const {description} = schema.parse(input);
        const code = await llm.invoke(`Generate JS code: ${description}`);
        const fileName = `gen-${Date.now()}.js`;
        await writeFile(join('generated', fileName), code.content);
        return `Generated: ${fileName}`;
    },
};