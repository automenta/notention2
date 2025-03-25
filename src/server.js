import {ServerState} from './server_state_manager.js';
import {ExecutionQueue} from './execution_queue_manager.js';
import {WebSocketServerManager} from './websocket_server.js';
import {NetentionServerCore} from './netention_server_core.js';
import {NoteHandler} from './note_handler.js';
import {NoteRunner} from './note_runner.js';
import {ErrorHandler} from './error_handler.js';
import {NoteStepHandler} from './note_step_handler.js';

const state = new ServerState();
const queueManager = new ExecutionQueue(state);
const websocketManager = new WebSocketServerManager(state);
const errorHandler = new ErrorHandler(state);
const noteStepHandler = new NoteStepHandler(state, errorHandler);
const noteRunner = new NoteRunner(state, null, errorHandler);
const noteHandler = new NoteHandler(state);

const serverCore = new NetentionServerCore(
    state,
    queueManager,
    websocketManager,
    errorHandler,
    noteStepHandler,
    noteRunner,
    noteHandler
);

serverCore.initialize();
