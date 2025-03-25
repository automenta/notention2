/**
 * Executes a tool and handles potential errors.
 * @param {object} state - The server state.
 * @param {object} note - The note being processed.
 * @param {object} step - The current step in the note's logic.
 * @param {string} toolName - The name of the tool to execute.
 * @param {Map} memoryMap - The memory map for the note.
 * @param {object} errorHandler - The error handler instance.
 * @returns {Promise<*>} - The result of the tool execution.
 * @throws {Error} - If the tool is not found or if the tool execution fails.
 */
export async function executeToolStep(state, note, step, toolName, memoryMap, errorHandler) {
    const tools = state.getTools();
    try {
        const tool = tools.getTool(toolName);
        if (!tool) {
            errorHandler.handleToolNotFoundError(note, step);
            throw new Error(`Tool ${toolName} not found`);
        }
        const result = await tool.invoke(step.input, { // Directly call tool.invoke
            graph: state.getGraph(),
            llm: state.getLLM(),
            state: state, // Pass the server state
            note: note, // Pass the current note
            step: step,  // Pass the current step
            errorHandler: errorHandler // Pass the error handler
        });
        memoryMap.set(step.id, result);
        note.memory.push({type: 'tool', content: result, timestamp: Date.now(), stepId: step.id});
        step.status = 'completed';
        await state.serverCore.writeNoteToDB(note);
        return result;
    } catch (error) {
        step.status = 'failed';
        errorHandler.handleToolStepError(note, step, error);
        throw new Error(`Tool execution failed: ${error.message}`);
    }
}
