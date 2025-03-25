import {z} from 'zod';
import {defineTool} from '../tool_utils.js';
import evalExprTool from './eval_expr.js';
import composeTool from './compose.js';

const schema = z.object({
    condition_expr: z.string(),
    then_branch: z.array(z.object({
        toolName: z.string(),
        input: z.any().optional()
    })),
    else_branch: z.array(z.object({
        toolName: z.string(),
        input: z.any().optional()
    }))
});

async function invoke(input, context) {
    const {condition_expr, then_branch, else_branch} = schema.parse(input);

    const conditionResult = await evalExprTool.invoke({expr: condition_expr}, context);
    const isConditionTrue = Boolean(conditionResult); // Cast to boolean

    if (isConditionTrue) {
        return await composeTool.invoke({toolChain: then_branch}, context);
    } else {
        return await composeTool.invoke({toolChain: else_branch}, context);
    }
}

export default defineTool({
    name: 'if_else',
    description: 'Conditional execution of tool branches based on an expression',
    schema,
    version: '1.0.0',
    dependencies: ['zod', './eval_expr.js', './compose.js'],
    invoke: invoke,
});
