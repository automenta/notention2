import { z } from 'zod';

const schema = z.object({
    testId: z.string()
});

export default {
    name: 'test_run',
    description: 'Run unit tests',
    schema,
    async invoke(input) {
        const { testId } = schema.parse(input);
        const notes = await import('../../src/server.js').then(m => m.notes);
        const testNote = notes.get(testId);
        if (!testNote) return `Test ${testId} not found`;
        const sandbox = { expect: (val) => ({ toBe: (exp) => val === exp }) };
        const fn = new Function('test', 'expect', testNote.content);
        let passed = true;
        fn((desc, cb) => { if (!cb()) passed = false; }, sandbox.expect);
        return passed ? 'Tests passed' : 'Tests failed';
    }
};
