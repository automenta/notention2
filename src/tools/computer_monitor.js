import {z} from 'zod';
import { withToolHandling, createSimpleInvoke } from '../tool_utils.js';
const si = require('systeminformation');

const schema = z.object({
    metric: z.enum(['cpu', 'memory', 'disk', 'network']),
    interval: z.number().min(1).optional(),
});

const invoke = createSimpleInvoke(schema);

async function invoke(input) {
    const {metric, interval = 5} = invoke(input); // Parse input here for consistency
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

export default {
    name: 'computer_monitor',
    description: 'Monitor computer stats',
    schema,
    dependencies: ['zod', 'systeminformation'],
    invoke: withToolHandling({ name: 'computer_monitor', schema, invoke }),
};
