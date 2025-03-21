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
            tools: ['tool1', 'tool2'],
            inputs: {initialInput: 'test'}
        };

        vi.mock('../../server.js', () => ({
            tools: tools,
        }));


        const result = await composeTool.invoke(input);

        expect(mockTool1.invoke).toHaveBeenCalledWith({initialInput: 'test'});
        expect(mockTool2.invoke).toHaveBeenCalledWith('result1');
        expect(result).toBe('result2');
    });

    it('should return an error if a tool is not found', async () => {
        const input = {
            tools: ['tool1', 'nonExistentTool'],
            inputs: {initialInput: 'test'}
        };
        const result = await composeTool.invoke(input);
        expect(result).toContain('Tool nonExistentTool not found');
    });
});
