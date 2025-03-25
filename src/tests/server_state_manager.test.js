import {describe, expect, it, vi} from 'vitest';
import {ServerState} from '../server_state_manager.js';
import {LLM} from '../llm.js';
import {Graph} from '../graph.js';
import {Tools} from '../tools.js';
import {InMemoryChatMessageHistory} from '@langchain/core/chat_history';

vi.mock('../llm.js', () => ({
    LLM: vi.fn()
}));

vi.mock('../graph.js', () => ({
    Graph: vi.fn()
}));

vi.mock('../tools.js', () => ({
    Tools: vi.fn()
}));

vi.mock('@langchain/core/chat_history', () => ({
    InMemoryChatMessageHistory: vi.fn()
}));


describe('ServerState', () => {
    it('should create instances of dependencies in constructor', () => {
        const serverState = new ServerState();
        expect(serverState.llm).toBeInstanceOf(LLM);
        expect(serverState.graph).toBeInstanceOf(Graph);
        expect(serverState.tools).toBeInstanceOf(Tools);
        expect(serverState.memory).toBeInstanceOf(InMemoryChatMessageHistory);
        expect(serverState.pendingWrites).toBeInstanceOf(Map);
        expect(serverState.updateBatch).toBeInstanceOf(Set);
    });

    it('timeoutPromise should return a promise that rejects after timeout', async () => {
        const serverState = new ServerState();
        const promise = serverState.timeoutPromise(Promise.resolve(), 100);
        await expect(promise).rejects.toThrowError('Timeout');
    }, 500);
});
