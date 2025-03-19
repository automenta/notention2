import {z} from 'zod';

const schema = z.object({
    metric: z.enum(['cpu', 'memory', 'disk', 'network']),
    interval: z.number().min(1).optional(), // Seconds
});

export default {
    name: 'computer_monitor',
    description: 'Monitor computer stats',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'systeminformation'], // External lib for system stats
    async invoke(input) {
        const {metric} = schema.parse(input);
        // TODO: Implement system monitoring with systeminformation or similar
        // - cpu: Return CPU usage %
        // - memory: Return memory usage
        // - disk: Return disk usage
        // - network: Return network stats
        return `Stub: Monitoring ${metric}`;
    }
};
