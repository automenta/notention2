import {describe, expect, it} from 'vitest';
import webSearchTool from '../tools/webSearch';

describe('Web Search Tool', () => {
    it('should return search results for a given query', async () => {
        const input = {query: 'test query'};
        const results = await webSearchTool.invoke(input);
        expect(results).toContain('Search results for: test query');
    });
});
