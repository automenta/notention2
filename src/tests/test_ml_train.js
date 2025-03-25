import {describe, expect, it} from '../test_utils';
import mlTrainTool from '../tools/ml_train.js';

describe('ML Train Tool', () => {
    it('should train an ML model and return modelId', async () => {
        const input = {modelType: 'dtree', data: [{features: [1, 2], label: 'A'}, {features: [3, 4], label: 'B'}]};
        const modelId = await mlTrainTool.invoke(input);
        expect(modelId).toBeDefined();
    });
});
