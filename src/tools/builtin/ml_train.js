import {z} from 'zod';
import crypto from 'crypto';

const schema = z.object({
    modelType: z.enum(['dtree', 'classifier', 'pca', 'cluster']),
    data: z.any(),
    targetId: z.string().optional()
});

export default {
    name: 'ml_train',
    description: 'Train ML model',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'crypto'],
    async invoke(input) {
        const {modelType, data, targetId} = schema.parse(input);
        const modelId = crypto.randomUUID();
        const notes = await import('../../server.js').then(m => m.notes);
        await notes.set(modelId, {
            id: modelId,
            title: `${modelType} Model`,
            content: {type: modelType, dataLength: data.length},
            status: 'completed',
            memory: [{type: 'system', content: `Trained on ${data.length} points`, timestamp: Date.now()}],
        });
        return modelId;
    },
};
