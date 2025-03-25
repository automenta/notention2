import {describe, expect, it, vi} from 'vitest';
import composeTool from '../tools/compose.js';

describe('Compose Tool', () => {
    it('should compose multiple tools and execute them in order', async () => {
        const mockTool1 = {
            name: 'tool1',
            invoke: vi.fn().mockResolvedValue('result1')
        };
        const mockTool2 = {
            name: 'tool2',
            invoke: vi.fn().mockResolvedValue('result2')
        };
        const tools = new Map([
            ['tool1', mockTool1],
            ['tool2', mockTool2]
        ]);
        const input = {
            toolChain: [ // toolChain is an array now
                {toolName: 'tool1', input: {initialInput: 'test'}}, // Input is per tool
                {toolName: 'tool2'} // Tool2 uses output of tool1 as input implicitly in chain
            ]
        };

        const context = {tools: {getTool: (name) => tools.get(name)}}; // Mock context

        const result = await composeTool.invoke(input, context);

        expect(mockTool1.invoke).toHaveBeenCalledWith({initialInput: 'test'}, context);
        expect(mockTool2.invoke).toHaveBeenCalledWith({}, context); // Tool2 input is empty object now
        expect(result).toEqual([ // Result is array of objects now
            {toolName: 'tool1', result: 'result1'},
            {toolName: 'tool2', result: 'result2'}
        ]);
    });

    it('should return an error if a tool is not found', async () => {
        const input = {
            toolChain: [
                {toolName: 'tool1', input: {initialInput: 'test'}},
                {toolName: 'nonExistentTool'}
            ]
        };
        const context = {tools: {getTool: (name) => new Map([['tool1', {}]]).get(name)}}; // Mock context with only tool1

        const result = await composeTool.invoke(input, context);
        expect(result).toContain('Tool \'nonExistentTool\' not found');
    });
});
