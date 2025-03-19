import z from 'zod';

const schema = z.object({
    query: z.string(),
    apiKey: z.string().optional(),
});

export default {
    name: 'webSearch',
    description: 'Search the web',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input) {
        const {query, apiKey} = schema.parse(input);
        const response = await fetch(`//api.example.com/search?q=${encodeURIComponent(query)}${apiKey ? `&key=${apiKey}` : ''}`);
        const data = await response.json();
        return data.results || `Search results for: ${query}`;
    },
};
