import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const si = require('systeminformation');

const schema = z.object({
    metric: z.enum(['cpu', 'memory', 'disk', 'network']),
    interval: z.number().min(1).optional(),
});

async function invoke(input, context) {
    const {metric, interval = 5} = schema.parse(input); // Parse input here for consistency
    let data;

    try {
        context.logToolStart();
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
        context.handleToolError(error);
    }
}

export default defineTool({
    name: 'computer_monitor',
    description: 'Monitor computer stats',
    schema,
    dependencies: ['zod', 'systeminformation'],
    invoke: invoke,
});
