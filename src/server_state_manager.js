import {InMemoryChatMessageHistory} from '@langchain/core/chat_history';
import {Graph} from './graph.js';
import {Tools} from './tools.js';
import {LLM} from './llm.js';
import {Logger} from './logger.js';
import {CONFIG} from './config.js';

export class ServerState {
    constructor() {
        this.config = CONFIG;
        this.logger = new Logger();
        this.llm = new LLM();
        this.graph = new Graph();
        this.tools = new Tools();
        this.memory = new InMemoryChatMessageHistory();
        this.pendingWrites = new Map();
        this.updateBatch = new Set();
        this.batchTimeout = null;
        this.scheduler = null;
        this.markStepAsCompleted = this.markStepAsCompletedFunc.bind(this);
    }

    async markStepAsCompletedFunc(note, step, stepResult) {
        step.status = 'completed';
        step.result = stepResult;
        await this.serverCore.writeNoteToDB(note);
    }

    getConfig() {
        return this.config;
    }

    getLogger() {
        return this.logger;
    }

    getLLM() {
        return this.llm;
    }

    getGraph() {
        return this.graph;
    }

    getTools() {
        return this.tools;
    }

    getMemory() {
        return this.memory;
    }
}
