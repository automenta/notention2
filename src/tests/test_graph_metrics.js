import {describe, expect, it} from 'vitest';
import graphMetricsTool from '../tools/builtin/graph_metrics';

describe('Graph Metrics Tool', () => {
    it('should return graph metrics', async () => {
        const input = {startId: 'dev-1'};
        const results = await graphMetricsTool.invoke(input);
        expect(results).toHaveProperty('degree');
        expect(results).toHaveProperty('nodes');
    });
});
