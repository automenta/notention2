import {z} from 'zod';
import {defineTool} from '../tool_utils.js';
import {exec} from 'child_process';
import util from 'util';
import os from 'os';

const execPromise = util.promisify(exec);

const schema = z.object({
    command: z.enum(['run', 'kill', 'list']),
    command_string: z.string().optional(), // For 'run' command
    process: z.string().optional(), // For 'kill' and 'list' commands
    script: z.string().optional(),
});

async function invoke(input, context) {
    const {command, command_string, process: processName} = schema.parse(input);

    try {
        context.logToolStart();
        if (command === 'run' && command_string) {
            const {stdout, stderr} = await execPromise(command_string);
            if (stderr) {
                console.error(`Command stderr: ${stderr}`);
            }
            return stdout || 'Command executed successfully with no output.';
        } else if (command === 'kill' && processName) {
            const killCommand = os.platform() === 'win32' ? `taskkill /IM ${processName} /F` : `killall ${processName}`;
            const {stdout, stderr} = await execPromise(killCommand);
            if (stderr && !stderr.includes('No matching processes found')) { // taskkill returns error even if process not found
                console.error(`Kill command stderr: ${stderr}`);
            }
            return stdout || `Successfully killed process(es) matching '${processName}'.`;
        } else if (command === 'list') {
            const listCommand = os.platform() === 'win32' ? 'tasklist' : 'ps aux';
            const {stdout, stderr} = await execPromise(listCommand);
            if (stderr) {
                console.error(`List command stderr: ${stderr}`);
            }
            return stdout || 'List processes command executed successfully with no output.';
        }

        return `Computer ${command} action is not fully implemented or requires necessary parameters.`;
    } catch (error) {
        context.handleToolError(error);
    }
}

export default defineTool({
    name: 'computer_use',
    description: 'Control computer processes',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'child_process', 'util', 'os'],
    invoke: invoke,
});
