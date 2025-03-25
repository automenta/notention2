import {ChatGoogleGenerativeAI} from '@langchain/google-genai';

import { CONFIG } from './config.js';

export class LLM {
    constructor() {
        this.llm = new ChatGoogleGenerativeAI({ model: CONFIG.LLM_MODEL, temperature: CONFIG.LLM_TEMPERATURE, maxRetries: CONFIG.LLM_MAX_RETRIES });
        this.promptCache = new Map();
        this.collabHistory = new Map();
        this.apiKeys = new Map();
    }

    timeoutPromise(promise, ms) {
        return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
    }

    async invoke(messages, collabNoteIds = [], apiContext = {}) {
        const prompt = messages[0].content;
        const cacheKey = `${prompt}:${collabNoteIds.join(',')}:${JSON.stringify(apiContext)}`;
        if (this.promptCache.has(cacheKey)) return this.promptCache.get(cacheKey);

        let context = '';
        if (collabNoteIds.length) {
            context += collabNoteIds.map(id => this.collabHistory.get(id) || `Note ${id}: No data`).join('\n');
        }
        if (Object.keys(apiContext).length) {
            context += `\nExternal Data: ${JSON.stringify(apiContext)}`;
        }
        if (context) messages.unshift({role: 'system', content: context});

        const result = await this.llm.invoke(messages);
        this.promptCache.set(cacheKey, result);
        if (collabNoteIds.length) collabNoteIds.forEach(id => this.collabHistory.set(id, result.text));
        return result;
    }

    async predictOutcome(noteId, scenario) {
        const prediction = await this.invoke([`Predict outcome for note ${noteId} given: ${scenario}`]);
        return prediction.text;
    }

    async fetchExternalData(apiName, query) {
        const key = this.apiKeys.get(apiName);
        if (!key) throw new Error(`No API key for ${apiName}`);
        const response = await fetch(`https://${apiName}.com/api?query=${encodeURIComponent(query)}&key=${key}`);
        return await response.json();
    }

    setApiKey(apiName, key) {
        this.apiKeys.set(apiName, key);
    }

    async clearCache() {
        this.promptCache.clear();
    }
}
