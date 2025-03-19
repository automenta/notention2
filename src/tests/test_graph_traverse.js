import {describe, expect, it} from 'vitest';
import graphTraverseTool from '../tools/builtin/graph_traverse';

describe('Graph Traverse Tool', () => {
    it('should traverse graph and return results', async () => {
        const input = {startId: 'seed-0', mode: 'bfs', callback: 'test'}; // Example input
        const results = await graphTraverseTool.invoke(input);
        expect(results).toContain('Traversed bfs from seed-0');
    });
});
