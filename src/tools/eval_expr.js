import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    expr: z.string(),
    context: z.record(z.any()).optional()
});

async function invoke(input) {
    const {expr, context} = schema.parse(input);
    try {
        const fn = new Function('context', `return ${expr}`);
        const result = fn(context || {});
        return result;
    } catch (error) {
        return `Error evaluating ${expr}: ${error.message}`;
    }
}

export default defineTool({
    name: 'eval_expr',
    description: 'Evaluate math/string expressions',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke,
});
