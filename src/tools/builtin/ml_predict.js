import { z } from 'zod';

const schema = z.object({
    modelId: z.string(),
    input: z.any()
});

export default {
    name: 'ml_predict',
    description: 'Predict with ML model',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const { modelId, input: data } = schema.parse(input);
        const graph = context.graph;
        const model = graph.getNote(modelId);

        if (!model) {
            return `Model ${modelId} not found`;
        }

        return `Predicted: ${JSON.stringify(data)} using ${model.content.type}`;
    }
};
