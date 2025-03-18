import z from 'zod';

export default {
    name: 'webSearch',
    description: 'Stub for web search',
    schema: z.object({query: z.string()}),
    async invoke(input) {
        return `Search results for: ${input.query}`;
        // Stub: LangChain web search integration
    },
};