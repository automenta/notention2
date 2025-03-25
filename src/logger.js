import { CONFIG } from './config.js';

export class Logger {
    constructor(debugEnabled = CONFIG.DEBUG_LOGGING) {
        this.debugEnabled = debugEnabled;
    }

    log(message, level = 'info', context = {}) {
        if (level === 'debug' && !this.debugEnabled) {
            return;
        }
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            ...context
        };
        console.log(JSON.stringify(logEntry)); // Or use a more sophisticated logging mechanism
    }

    debug(message, context = {}) {
        this.log(message, 'debug', context);
    }

    info(message, context = {}) {
        this.log(message, 'info', context);
    }

    warn(message, context = {}) {
        this.log(message, 'warn', context);
    }

    error(message, context = {}) {
        this.log(message, 'error', context);
    }
}
