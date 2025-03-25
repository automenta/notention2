import {describe, expect, it} from 'vitest';
import graphTraverseTool from '../tools/graph_traverse.js';

describe('Graph Traverse Tool', () => {
    it('should traverse graph and return results', async () => {
        const input = { startId: 'seed-0', mode: 'bfs', callback: 'test' };
        const results = await graphTraverseTool.invoke(input);
        expect(results).toContain('Traversed bfs from seed-0');
    });
});
