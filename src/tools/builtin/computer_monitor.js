import {z} from 'zod';

const schema = z.object({
    metric: z.enum(['cpu', 'memory', 'disk', 'network']),
    interval: z.number().min(1).optional(),
});

export default {
    name: 'computer_monitor',
    description: 'Monitor computer stats',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'systeminformation'],
    async invoke(input) {
        const {metric} = schema.parse(input);
        return `Stub: Monitoring ${metric}`;
    }
};
