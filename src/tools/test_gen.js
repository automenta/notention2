import {z} from 'zod';

const schema = z.object({
    code: z.string(),
    targetId: z.string()
});

export default {
    name: 'test_gen',
    description: 'Generate comprehensive unit tests for a given Javascript code snippet, focusing on robustness and coverage.',
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

        const prompt = `You are a highly skilled Javascript developer specializing in writing robust and comprehensive unit tests using Jest. 
        Your task is to generate a complete suite of unit tests for the provided Javascript code. The goal is to achieve maximum test coverage, ensuring that all functionalities are thoroughly validated, including:

        - Core functionality: Verify the primary functions and features work as expected.
        - Edge cases: Test boundary conditions, unusual inputs, and unexpected scenarios.
        - Error handling: Ensure proper error handling and informative error messages.
        - Asynchronous behavior: Test asynchronous operations, promises, and async/await.
        - Integration points: If the code interacts with other modules or external APIs, test these integrations.

        Consider the following context about the code's purpose and environment within the Netention system (if available):

        \`\`\`
        ${noteContext}
        \`\`\`

        Write the tests using Jest syntax. The output should be ONLY the Javascript code for the tests, ready to be executed with Jest. 
        Do not include any explanatory text, comments outside the test code, or any other extraneous information. 
        The tests should be clear, readable, and maintainable, providing confidence in the code's correctness and reliability.

        If there are external dependencies or context required for the code to run (like browser APIs, Node.js modules, or specific environment variables), generate mock implementations or setup instructions within the test code to make the tests self-contained and runnable in isolation.

        Ensure that the generated tests are independent and do not rely on external state or the execution order of other tests. Each test should set up its own environment and assert specific outcomes.

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
