export class Executor {
    constructor(toolRegistry) {
        this.toolRegistry = toolRegistry;
    }

    async executeStep(step) {
        const tool = this.toolRegistry.getTool(step.tool);
        if (tool) {
            try {
                const result = await tool.invoke(step.input);
                step.status = 'completed';
                return result;
            } catch (error) {
                step.status = 'failed';
                throw error;
            }
        } else {
            step.status = 'failed';
            throw new Error(`Tool ${step.tool} not found`);
        }
    }
}
