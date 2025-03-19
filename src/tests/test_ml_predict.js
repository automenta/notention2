import {describe, expect, it} from 'vitest';
import mlPredictTool from '../tools/builtin/ml_predict';

describe('ML Predict Tool', () => {
    it('should predict using a trained ML model', async () => {
        const input = {modelId: 'test-model-id', input: {features: [5, 6]}}; // Example modelId and input
        const results = await mlPredictTool.invoke(input);
        expect(results).toContain('Predicted:');
    });
});
