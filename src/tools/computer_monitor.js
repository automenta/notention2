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
    import {z} from 'zod';
    import si from 'systeminformation';

    const schema = z.object({
        metric: z.enum(['cpu', 'memory', 'disk', 'network']),
        interval: z.number().min(1).optional(), // Interval in seconds
    });

    export default {
        name: 'computer_monitor',
        description: 'Monitor computer stats',
        schema,
        version: '1.0.0',
        dependencies: ['zod', 'systeminformation'],
        async invoke(input) {
            const {metric, interval = 5} = schema.parse(input); // Default interval to 5 seconds
            let data;

            try {
                switch (metric) {
                    case 'cpu':
                        data = await si.cpuCurrentSpeed();
                        break;
                    case 'memory':
                        data = await si.mem();
                        break;
                    case 'disk':
                        data = await si.diskio();
                        break;
                    case 'network':
                        data = await si.networkStats();
                        break;
                    default:
                        return `Error: Metric '${metric}' is not supported.`;
                }
                return JSON.stringify({metric: metric, data: data}, null, 2);
            } catch (error) {
                console.error(`Error monitoring ${metric}:`, error);
                return `Error monitoring ${metric}: ${error.message}`;
            }
        }
    };
