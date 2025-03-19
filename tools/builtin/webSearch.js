import z from 'zod';

const schema = z.object({
    query: z.string(),
    apiKey: z.string().optional(), // Optional API key for external service
});

export default {
    name: 'webSearch',
    description: 'Search the web',
    schema,
    async invoke(input) {
        const { query, apiKey } = schema.parse(input);
        // Placeholder for actual API call (e.g., SerpAPI)
        const response = await fetch(`//api.example.com/search?q=${encodeURIComponent(query)}${apiKey ? `&key=${apiKey}` : ''}`);
        const data = await response.json();
        return data.results || `Search results for: ${query}`; // Adjust based on API response
    },
};
