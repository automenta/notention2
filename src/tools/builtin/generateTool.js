import { z } from 'zod';

const schema = z.object({
    name: z.string(),
    desc: z.string(),
    code: z.string()
});

export default {
    name: 'generateTool',
    description: 'Generate a new tool at runtime',
    schema,
    async invoke(input, context) {
        const { name, desc, code } = schema.parse(input);
        return { name, desc, code };
    }
};
