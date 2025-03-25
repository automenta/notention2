import {InMemoryChatMessageHistory} from '@langchain/core/chat_history';
import {Graph} from './graph.js';
import {Tools} from './tools.js';
import {LLM} from './llm.js';
import {CONFIG} from './config.js';

export class ServerState {
    llm;
    graph;
    tools;
    memory;
    wss;
    messageQueue;
    pendingWrites;
    updateBatch;
    batchTimeout;
    scheduler;

    constructor() {
        this.llm = new LLM(); // Instantiate LLM Class
        this.graph = new Graph();
        this.tools = new Tools();
        this.memory = new InMemoryChatMessageHistory();
        this.wss = null;
        this.messageQueue = [];
        this.pendingWrites = new Map();
        this.updateBatch = new Set();
        this.batchTimeout = null;
        this.scheduler = null;
    }

    log(message, level = 'info', context = {}) {
        if (level === 'debug' && !CONFIG.DEBUG_LOGGING) {
            return;
        }
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            ...context
        };
        console[level](JSON.stringify(logEntry));
    }

    timeoutPromise(promise, ms) {
        return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
    }
}

