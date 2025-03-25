import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import {PromptTemplate} from "@langchain/core/prompts";
import {LLMChain} from "langchain/chains";

const schema = z.object({
    text: z.string(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    style: z.enum(['bullet', 'paragraph']).optional(),
});

const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1, maxRetries: 2});

const promptTemplate = PromptTemplate.fromTemplate(
    "Summarize this text in a {length} {style}:\n\n{text}"
);

const chain = new LLMChain({llm: llm, prompt: promptTemplate});

async function handleStep(note, step, context) {
    try {
        const result = await context.tools.executeTool('summarize', step.input, {
            graph: context.graph,
            llm: context.llm
        });
        note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await context.state.writeNoteToDB(note);
    } catch (error) {
        context.errorHandler.handleToolStepError(note, step, error); // Use ErrorHandler
    }
}


export default {
    name: 'summarize',
    description: 'Summarize text',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input) {
        const {text, length = 'medium', style = 'paragraph'} = schema.parse(input);
        const result = await chain.call({text, length, style});
        return result.text || 'No summary generated';
    },
    handleStep // Export the handleStep function
};
