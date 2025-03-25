import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const schema = z.object({
    description: z.string(),
    execute: z.boolean().optional(),
});

const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1});

async function handleStep(note, step, context) {
    try {
        const result = await context.tools.executeTool('generateCode', step.input, {
            graph: context.graph,
            llm: context.llm
        });
        note.memory.push({type: 'codeGen', content: result, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await context.state.serverCore.writeNoteToDB(note);
    } catch (error) {
        context.errorHandler.handleToolStepError(note, step, error); // Use ErrorHandler
    }
}

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
    },
    handleStep // Export the handleStep function
};
