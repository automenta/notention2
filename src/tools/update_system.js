import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    update_instructions: z.string()
});

async function invoke(input, context) { // Rename original invoke to invokeImpl
    const {update_instructions} = schema.parse(input); // Parse input here for consistency

    context.log(`Update System Tool invoked with instructions: ${update_instructions}`, 'info', {
        component: 'update_system',
        instructions: update_instructions
    });

    return `System update instructions received and logged. Instructions: ${update_instructions}`;
}


export default defineTool({
    name: 'update_system',
    description: 'Update the Netention system based on provided instructions',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    try {
        context.logToolStart();
        const {update_instructions} = schema.parse(input); // Parse input here for consistency

        context.log(`Update System Tool invoked with instructions: ${update_instructions}`, 'info', {
            component: 'update_system',
            instructions: update_instructions
        });

        return `System update instructions received and logged. Instructions: ${update_instructions}`;
    } catch(error) {
        context.handleToolError(error);
    }
}


export default defineTool({
    name: 'update_system',
    description: 'Update the Netention system based on provided instructions',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke,
});
