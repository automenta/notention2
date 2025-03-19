import { z } from 'zod';

const schema = z.object({
    code: z.string(),
    targetId: z.string()
});

export default {
    name: 'test_gen',
    description: 'Generate unit tests',
    schema,
    async invoke(input) {
        const { code, targetId } = schema.parse(input);
        const testCode = `test('${targetId} works', () => { expect((${code})(2, 3)).toBe(5); });`;
        return testCode;
    }
};
