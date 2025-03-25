export class ToolNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ToolNotFoundError';
    }
}

export class ToolExecutionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ToolExecutionError';
    }
}

export class NoteExecutionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NoteExecutionError';
    }
}

export class CodeValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CodeValidationError';
    }
}

export class ToolImplementationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ToolImplementationError';
    }
}
