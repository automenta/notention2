import {z} from 'zod';

const schema = z.object({
    update_instructions: z.string()
});

export default {
    name: 'update_system',
    description: 'Update the Netention system based on provided instructions',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {update_instructions} = schema.parse(input);

        context.log(`Update System Tool invoked with instructions: ${update_instructions}`, 'info', {
            component: 'update_system',
            instructions: update_instructions
        });

        return `System update instructions received and logged. Instructions: ${update_instructions}`;
    }
};
import { withToolHandling } from '../tool_utils.js';

async function invoke(input, context) {
    const {update_instructions} = schema.parse(input);

    context.log(`Update System Tool invoked with instructions: ${update_instructions}`, 'info', {
        component: 'update_system',
        instructions: update_instructions
    });

    return `System update instructions received and logged. Instructions: ${update_instructions}`;
}

export default {
    name: 'update_system',
    description: 'Update the Netention system based on provided instructions',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: withToolHandling({ name: 'update_system', schema, invoke }),
};
