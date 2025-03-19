import { z } from 'zod';
import crypto from 'crypto';

const schema = z.object({
    code: z.string(),
    targetId: z.string()
});

export default {
    name: 'test_gen',
    description: 'Generate unit tests',
    schema,
    async invoke(input, context) {
        const { code, targetId } = schema.parse(input);
        const graph = context.graph;
        const testCode = `test('${targetId} works', () => { expect((${code})(2, 3)).toBe(5); });`;
        const testId = crypto.randomUUID();

        await graph.addNote({
            id: testId,
            title: `Test for ${targetId}`,
            content: testCode,
            status: 'pending',
        });
        if (targetId) {
            graph.addEdge(testId, targetId, 'tests');
        }
        return testCode;
    }
};
