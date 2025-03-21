import {describe, expect, it} from 'vitest';
import evalExprTool from '../tools/eval_expr.js';

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

    it('should collaborate between notes', async () => {
        const input = {expr: 'context.a + context.b', context: {a: 2, b: await evalExprTool.invoke({expr: '3'})}};
        const result = await evalExprTool.invoke(input);
        expect(result).toBe(5);
    });

    it('should evaluate dynamically generated tool', async () => {
        const dynamicTool = {expr: 'input.x * 2', context: {x: 3}};
        const result = await evalExprTool.invoke(dynamicTool);
        expect(result).toBe(6);
    });
});
