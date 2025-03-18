import {ChatOpenAI} from '@langchain/openai';
import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const schema = z.object({
    text: z.string(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    style: z.enum(['bullet', 'paragraph']).optional(),
});
//const llm = new ChatOpenAI({openAIApiKey: process.env.OPENAI_API_KEY});
const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1, maxRetries: 2});


export default {
    name: 'summarize',
    description: 'Summarize text',
    schema,
    async invoke(input) {
        const { text, length = 'medium', style = 'paragraph' } = schema.parse(input);
        const prompt = `Summarize this text in a ${length} ${style}: ${text}`;
        const summary = await llm.invoke(prompt);
        return summary.content || 'No summary generated';
    },
};
