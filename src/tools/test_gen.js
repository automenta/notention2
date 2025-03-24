import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const schema = z.object({
    code: z.string(),
    targetId: z.string()
});

export default {
    name: 'test_gen',
    description: 'Generate unit tests for a given code snippet',
    schema,
    version: '1.0.0',
    dependencies: ['zod', '@langchain/google-genai'],
    async invoke(input, context) {
        const {code, targetId} = schema.parse(input);
        const llm = context.llm;

        const prompt = `You are a world-class expert in Javascript and proficient in writing excellent unit tests using Jest. 
        Generate a comprehensive suite of unit tests for the following Javascript code, ensuring all functionalities are thoroughly tested, 
        including edge cases and error handling. The tests should be directly executable with Jest and cover all aspects of the code. 
        Output ONLY the Javascript code for the tests, and nothing else.

        \`\`\`javascript
        ${code}
        \`\`\`
        `;

        try {
            const llmResult = await llm.invoke([{role: 'user', content: prompt}]);
            const testCode = llmResult.text;

            if (!testCode) {
                throw new Error("Failed to generate test code from LLM.");
            }

            return testCode;
        } catch (error) {
            console.error("Error generating test code:", error);
            return `Error generating test code: ${error.message}`;
        }
    }
};
