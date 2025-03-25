/**
 * Executes a tool and handles potential errors.
 * @param {object} state - The server state.
 * @param {object} note - The note being processed.
 * @param {object} step - The current step in the note's logic.
 * @param {string} toolName - The name of the tool to execute.
 * @param {Map} memoryMap - The memory map for the note.
 * @param {object} errorHandler - The error handler instance.
 * @returns {Promise<*>} - The result of the tool execution, or an error message.
 */
export async function executeToolStep(state, note, step, toolName, memoryMap, errorHandler) {
    try {
        const tool = state.tools.getTool(toolName);
        if (!tool) {
            errorHandler.handleToolNotFoundError(note, step);
            return `Tool ${toolName} not found`;
        }
        const result = await tool.execute(step.input, {
            graph: state.graph,
            llm: state.llm
        });
        memoryMap.set(step.id, result);
        note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await state.serverCore.writeNoteToDB(note);
        return result;
    } catch (error) {
        step.status = 'failed';
        errorHandler.handleToolStepError(note, step, error);
        return `Tool execution failed: ${error.message}`;
    }
}
