import {describe, expect, it} from 'vitest';
import summarizeTool from '../tools/summarize.js'; // Updated import path

describe('Summarize Tool', () => {
    it('should summarize text', async () => {
        const input = {text: 'This is a long text that needs to be summarized.'};
        const results = await summarizeTool.invoke(input);
        expect(results).toContain('summary');
    });
});
