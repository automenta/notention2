import {InMemoryChatMessageHistory} from '@langchain/core/chat_history';
import {Graph} from './graph.js';
import {Tools} from './tools.js';
import {LLM} from './llm.js';
import { Logger } from './logger.js';

export class ServerState {
    llm;
    graph;
    tools;
    memory;
    pendingWrites;
    updateBatch;
    batchTimeout;
    scheduler;
    pendingWrites;
    updateBatch;
    logger; // Logger instance

    constructor() {
        this.logger = new Logger(); // Instantiate Logger
        this.llm = new LLM(); // Instantiate LLM Class
        this.graph = new Graph();
        this.tools = new Tools();
        this.memory = new InMemoryChatMessageHistory();
        this.pendingWrites = new Map();
        this.updateBatch = new Set();
        this.batchTimeout = null;
        this.scheduler = null;
    }
}
