import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    testId: z.string()
});

async function invoke(input, context) {
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
        expect: global.expect,
        describe: global.describe,
        it: global.it,
        vi: global.vi,
        test: global.test,
        console,
        results: [] // Initialize results array in sandbox
    };

    const testFn = new Function('test', 'describe', 'expect', 'it', 'vi', 'console', 'results', `
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
        await testFn(global.test, global.describe, sandbox.expect, global.it, global.vi, sandbox.console, sandbox.results);
        return JSON.stringify({status: 'completed', results: sandbox.results}, null, 2); // Return sandbox.results
    } catch (error) {
        console.error(`Test execution error in Note ${testId}:`, error);
        return JSON.stringify({status: 'failed', error: error.message}, null, 2);
    }
}

export default defineTool({
    name: 'test_run',
    description: 'Run unit tests for a specified test Note',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    try {
        context.logToolStart();
        const {testId} = schema.parse(input);
        const graph = context.graph;
        const testNote = graph.getNote(testId);

        if(
!testNote
)
{
    return `Test Note ${testId} not found`;
}

if (testNote.content.type !== 'test') {
    return `Note ${testId} is not a test Note`;
}

const sandbox = {
    expect: global.expect,
    describe: global.describe,
    it: global.it,
    vi: global.vi,
    test: global.test,
    console,
    results: [] // Initialize results array in sandbox
};

const testFn = new Function('test', 'describe', 'expect', 'it', 'vi', 'console', 'results', `
            return new Promise(async (resolve, reject) => {
                try {
                    ${testNote.content.code}
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            });
        `);

await testFn(global.test, global.describe, sandbox.expect, global.it, global.vi, sandbox.console, sandbox.results);
return JSON.stringify({status: 'completed', results: sandbox.results}, null, 2); // Return sandbox.results
} catch
(error)
{
    context.handleToolError(error);
}
}

export default defineTool({
    name: 'test_run',
    description: 'Run unit tests for a specified test Note',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke,
});
