import {describe, expect, it} from 'vitest';
import evalExprTool from '../tools/builtin/eval_expr';

describe('Eval Expr Tool', () => {
    it('should evaluate a math expression', async () => {
        const input = {expr: '2 + 2'};
        const result = await evalExprTool.invoke(input);
        expect(result).toBe(4);
    });

    it('should handle string expressions', async () => {
        const input = {expr: '"hello" + " world"'};
        const result = await evalExprTool.invoke(input);
        expect(result).toBe('hello world');
    });

    it('should handle expressions with context', async () => {
        const input = {expr: 'context.a + context.b', context: {a: 5, b: 3}};
        const result = await evalExprTool.invoke(input);
        expect(result).toBe(8);
    });

    it('should return an error message for invalid expressions', async () => {
        const input = {expr: 'invalid expression'};
        const result = await evalExprTool.invoke(input);
        expect(result).toContain('Error evaluating invalid expression');
    });
});
