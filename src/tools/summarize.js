import {ChatOpenAI} from '@langchain/openai';
import {z} from 'zod';

const schema = z.object({text: z.string()});
const llm = new ChatOpenAI({openAIApiKey: process.env.OPENAI_API_KEY});

export default {
    name: 'summarize',
    description: 'Summarize text',
    schema,
    async invoke(input) {
        const {text} = schema.parse(input);
        const summary = await llm.invoke(`Summarize: ${text}`);
        return summary.content;
    },
};