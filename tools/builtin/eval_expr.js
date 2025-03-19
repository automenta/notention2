import { z } from 'zod';

const schema = z.object({
    expr: z.string(),
    context: z.record(z.any()).optional()
});

export default {
    name: 'eval_expr',
    description: 'Evaluate math/string expressions',
    schema,
    async invoke(input) {
        const { expr, context } = schema.parse(input);
        try {
            const fn = new Function('context', `return ${expr}`);
            const result = fn(context || {});
            return result;
        } catch (error) {
            return `Error evaluating ${expr}: ${error.message}`;
        }
    }
};
