import { describe, it, expect, vi } from 'vitest';
import NetentionServer from '../netention_server.js';
import { ServerState } from '../server_state_manager.js';
import { ExecutionQueue } from '../execution_queue_manager.js';
import { WebSocketServerManager } from '../websocket_handler.js';
import { ErrorHandler } from '../error_handler.js';
import { NoteRunner } from '../note_runner.js';
import { NoteStepHandler } from '../note_step_handler.js';
import { NoteHandler } from '../note_handler.js';

vi.mock('../server_state_manager.js', () => ({
    ServerState: vi.fn(() => ({
        log: vi.fn(),
        llm: { setApiKey: vi.fn() }
    }))
}));
vi.mock('../execution_queue_manager.js', () => ({
    ExecutionQueue: vi.fn(() => ({
        initScheduler: vi.fn()
    }))
}));
vi.mock('../websocket_handler.js', () => ({
    WebSocketServerManager: vi.fn(() => ({
        start: vi.fn()
    }))
}));
vi.mock('../error_handler.js', () => ({
    ErrorHandler: vi.fn()
}));
vi.mock('../note_runner.js', () => ({
    NoteRunner: vi.fn()
}));
vi.mock('../note_step_handler.js', () => ({
    NoteStepHandler: vi.fn()
}));
vi.mock('../note_handler.js', () => ({
    NoteHandler: vi.fn()
}));
vi.mock('../tool_loader.js', () => ({
    ToolLoader: vi.fn(() => ({
        loadTools: vi.fn()
    }))
}));
vi.mock('../note_loader.js', () => ({
    NoteLoader: vi.fn(() => ({
        loadNotes: vi.fn()
    }))
}));


describe('NetentionServer', () => {
    it('should create instances of dependencies in constructor', () => {
        const server = new NetentionServer();
        expect(server.state).toBeInstanceOf(ServerState);
        expect(server.queueManager).toBeInstanceOf(ExecutionQueue);
        expect(server.websocketManager).toBeInstanceOf(WebSocketServerManager);
        expect(server.errorHandler).toBeInstanceOf(ErrorHandler);
        expect(server.noteRunner).toBeInstanceOf(NoteRunner);
        expect(server.noteStepHandler).toBeInstanceOf(NoteStepHandler);
        expect(server.noteHandler).toBeInstanceOf(NoteHandler);
    });

    it('initialize should call dependency methods', async () => {
        const server = new NetentionServer();
        await server.initialize();
        expect(server.state.llm.setApiKey).toHaveBeenCalled();
        expect(server.queueManager.initScheduler).toHaveBeenCalled();
        expect(server.websocketManager.start).toHaveBeenCalled();
    });

    it('log should call state.log', () => {
        const server = new NetentionServer();
        const logSpy = vi.spyOn(server.state, 'log');
        server.log('test message');
        expect(logSpy).toHaveBeenCalledWith('test message', 'info', {});
    });

    it('timeoutPromise should return a promise that rejects after timeout', async () => {
        const server = new NetentionServer();
        const promise = server.timeoutPromise(Promise.resolve(), 100);
        await expect(promise).rejects.toThrowError('Timeout');
    }, 500);
});
