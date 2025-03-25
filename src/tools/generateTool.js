import {z} from 'zod';
import { defineTool } from '../tool_utils.js';

const schema = z.object({
    name: z.string(),
    desc: z.string(),
    code: z.string()
});

async function invoke(input, context) {
    const { name, desc, code } = schema.parse(input);
    const toolDef = {name, description: desc, schema: z.object({}), invoke: new Function('input', 'context', code)};
    context.state.tools.addTool(toolDef);
    return `Tool ${name} generated`;
}


export default defineTool({
    name: 'generateTool',
    description: 'Generate a new tool at runtime',
    schema,
    try {
        context.logToolStart();
        const { name, desc, code } = schema.parse(input);
        const toolDef = {name, description: desc, schema: z.object({}), invoke: new Function('input', 'context', code)};
        context.state.tools.addTool(toolDef);
        return `Tool ${name} generated`;
    } catch (error) {
        context.handleToolError(error);
    }
}

export default defineTool({
    name: 'generateTool',
    description: 'Generate a new tool at runtime',
    schema,
    invoke: invoke,
});
