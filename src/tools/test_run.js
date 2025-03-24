import {z} from 'zod';

const schema = z.object({
    testId: z.string()
});

export default {
    name: 'test_run',
    description: 'Run unit tests',
    schema,
    async invoke(input, context) {
        const {testId} = schema.parse(input);
        const graph = context.graph;
        const testNote = graph.getNote(testId);

        if (!testNote) {
            return `Test ${testId} not found`;
        }

        const sandbox = {expect: (val) => ({toBe: (exp) => val === exp})};
        let results = [];
        const testFn = new Function('test', 'expect', 'results', `
            return new Promise(async (resolve, reject) => {
                try {
                    ${testNote.content}
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            });
        `);

        try {
            const testResults = await testFn((desc, cb) => {
                try {
                    cb();
                    results.push({desc, pass: true});
                } catch (error) {
                    results.push({desc, pass: false, error: error.message});
                }
            }, sandbox.expect, results);
            return JSON.stringify(testResults, null, 2);
        } catch (error) {
            return `Test execution error: ${error.message}`;
        }
    }
};
