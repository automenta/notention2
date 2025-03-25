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
    async invoke(input, context) {
        const {query, apiKey} = schema.parse(input);
        const apiUrl = `https://api.example.com/search?q=${encodeURIComponent(query)}${apiKey ? `&key=${apiKey}` : ''}`; // Placeholder API URL

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return JSON.stringify(data.results || {message: `Search results for: ${query}`, query: query}, null, 2);
        } catch (error) {
            console.error("Web search failed:", error);
            return `Web search failed: ${error.message}. Query: ${query}`;
        }
    },
};
