import { z } from 'zod';

const schema = z.object({
    testId: z.string()
});

export default {
    name: 'test_run',
    description: 'Run unit tests',
    schema,
    async invoke(input, context) {
        const { testId } = schema.parse(input);
        const graph = context.graph;
        const testNote = graph.getNote(testId);
        if (!testNote) return `Test ${testId} not found`;
        const sandbox = { expect: (val) => ({ toBe: (exp) => val === exp }) };
        const fn = new Function('test', 'expect', testNote.content);
        let passed = true;
        fn((desc, cb) => {
            if (!cb()) passed = false;
        }, sandbox.expect);
        return passed ? 'Tests passed' : 'Tests failed';
    }
};
