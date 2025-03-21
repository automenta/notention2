import {describe, expect, it} from 'vitest';
import mlPredictTool from '../tools/ml_predict.js';

describe('ML Predict Tool', () => {
    it('should predict using a trained ML model', async () => {
        const input = {modelId: 'test-model-id', input: {features: [5, 6]}};
        const results = await mlPredictTool.invoke(input);
        expect(results).toContain('Predicted:');
    });
});
