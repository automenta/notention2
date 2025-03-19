import {z} from 'zod';

const schema = z.object({
    modelId: z.string(),
    input: z.any()
});

export default {
    name: 'ml_predict',
    description: 'Predict with ML model',
    schema,
    async invoke(i) {
        const {modelId, input} = schema.parse(i);
        const notes = await import('../../server.js').then(m => m.notes);
        const model = notes.get(modelId);
        if (!model) return `Model ${modelId} not found`;
        return `Predicted: ${JSON.stringify(input)} using ${model.content.type}`;
    }
};
