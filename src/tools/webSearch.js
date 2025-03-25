import z from 'zod';
import { withToolHandling, createSimpleInvoke } from '../tool_utils.js';

const schema = z.object({
    query: z.string(),
    apiKey: z.string().optional(),
});

const invoke = createSimpleInvoke(schema);

async function invokeImpl(input, context) { // Rename original invoke to invokeImpl
    const {query, apiKey} = invoke(input); // Parse input here for consistency
    const apiKeyToUse = apiKey || context?.apiKey || ''; // Use input apiKey, or context apiKey, or empty string
    const apiUrl = `https://api.example.com/search?q=${encodeURIComponent(query)}${apiKeyToUse ? `&key=${apiKeyToUse}` : ''}`; // Placeholder API URL

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
}


export default {
    name: 'webSearch',
    description: 'Search the web',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: withToolHandling({ name: 'webSearch', schema, invoke: invokeImpl }), // Use invokeImpl in withToolHandling
};
