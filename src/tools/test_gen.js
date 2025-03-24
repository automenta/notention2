import {z} from 'zod';

const schema = z.object({
    code: z.string(),
    targetId: z.string()
});

export default {
    name: 'test_gen',
    description: 'Generate unit tests',
    schema,
    async invoke(input, context) {
        const {code, targetId} = schema.parse(input);
        const graph = context.graph;
        const llm = context.llm;

        const prompt = `Generate unit tests in Jest syntax for the following Javascript code:\n\n\`\`\`javascript\n${code}\n\`\`\`\n\nThe tests should be comprehensive and cover various scenarios, including edge cases and error handling. Focus on testing the core logic and functionality of the code.`;
        const llmResult = await llm.invoke([{role: 'user', content: prompt}]);
        const testCode = llmResult.text;

        if (!testCode) {
            throw new Error("Failed to generate test code.");
        }

        return testCode;
    }
};
