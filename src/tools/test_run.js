import {z} from 'zod';

const schema = z.object({
    testId: z.string()
});

export default {
    name: 'test_run',
    description: 'Run unit tests for a specified test Note',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {testId} = schema.parse(input);
        const graph = context.graph;
        const testNote = graph.getNote(testId);

        if (!testNote) {
            return `Test Note ${testId} not found`;
        }

        if (testNote.content.type !== 'test') {
            return `Note ${testId} is not a test Note`;
        }

        const sandbox = {
            expect: global.expect, // Use global expect from vitest environment
            describe: global.describe, // Use global describe
            it: global.it, // Use global it
            vi: global.vi, // Use global vi
            test: global.test, // Use global test
            console,
        };

        let results = [];
        const testFn = new Function('test', 'describe', 'expect', 'it', 'vi', 'results', 'console', `
            return new Promise(async (resolve, reject) => {
                try {
                    
                    ${testNote.content.code}
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            });
        `);

        try {
            const testResults = await testFn(global.test, global.describe, sandbox.expect, global.it, sandbox.vi, results, sandbox.console);
            return JSON.stringify({status: 'completed', results: testResults}, null, 2);
        } catch (error) {
            console.error(`Test execution error in Note ${testId}:`, error);
            return JSON.stringify({status: 'failed', error: error.message}, null, 2);
        }
    }
};
