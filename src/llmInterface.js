import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export class LLMInterface {
    constructor() {
        this.llm = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash", temperature: 1, maxRetries: 2 });
    }

    async invoke(messages) {
        return await this.llm.invoke(messages);
    }
}
