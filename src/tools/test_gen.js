import {z} from 'zod';
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const schema = z.object({
    code: z.string(),
    targetId: z.string()
});

export default {
    name: 'test_gen',
    description: 'Generate unit tests for a given code snippet using Jest, aiming for comprehensive coverage including edge cases and error handling.',
    schema,
    version: '1.0.0',
    dependencies: ['zod', '@langchain/google-genai'],
    async invoke(input, context) {
        const {code, targetId} = schema.parse(input);
        const llm = context.llm;
        const graph = context.graph;
        const targetNote = graph.getNote(targetId);

        let noteContext = "";
        if (targetNote) {
            noteContext = `
            Note Title: ${targetNote.title}
            Note Content: ${JSON.stringify(targetNote.content, null, 2)}
            Note Logic: ${JSON.stringify(targetNote.logic, null, 2)}
            Note Memory (last 5 entries): ${JSON.stringify(targetNote.memory.slice(-5), null, 2)}
            `;
        }


        const prompt = `You are a world-class expert in Javascript and proficient in writing excellent unit tests using Jest. 
        Your goal is to create a comprehensive suite of unit tests for the Javascript code provided below. 
        Consider the context of the code within the Netention system, if provided. 
        These tests should be robust, covering various scenarios, including:

        1.  **Basic Functionality**: Test the primary functions and features of the code to ensure they work as expected under normal conditions.
        2.  **Edge Cases**: Identify and test boundary conditions, unusual inputs, or situations that might cause unexpected behavior.
        3.  **Error Handling**: Verify that the code gracefully handles errors, exceptions, and invalid inputs, and provides informative error messages when necessary.
        4.  **Asynchronous Operations**: If the code involves asynchronous operations (like Promises or async/await), ensure tests cover these aspects, including timeouts and error conditions.
        5.  **State Management**: If the code manages state, test state transitions and ensure that the state is correctly updated throughout the code execution.
        6.  **Integration Points**: If the code interacts with other modules, libraries, or external services, include integration tests to verify these interactions.

        Context about the Note being tested (if available):
        \`\`\`
        ${noteContext}
        \`\`\`


        The tests MUST be written using Jest syntax and should be directly executable. Focus on creating tests that are:

        -   **Clear and Readable**: Tests should be easy to understand and maintain.
        -   **Comprehensive**: Cover all significant aspects of the code.
        -   **Independent**: Each test should be self-contained and not rely on the state of other tests.

        Assume you are testing a module or class that will be used in a larger system. Aim for professional-quality unit tests that provide confidence in the code's correctness.

        Output ONLY the Javascript code for the tests, and nothing else. Do not include any explanations or comments outside of the test code itself.

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
