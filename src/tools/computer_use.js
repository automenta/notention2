import {z} from 'zod';
import { defineTool } from '../tool_utils.js';
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

async function invoke(input) {
    const {command, command_string, process: processName} = schema.parse(input);

    if (command === 'run' && command_string) {
        try {
            const {stdout, stderr} = await execPromise(command_string);
            if (stderr) {
                console.error(`Command stderr: ${stderr}`);
            }
            return stdout || 'Command executed successfully with no output.';
        } catch (error) {
            console.error(`Error executing command: ${error}`);
            return `Error executing command: ${error.message}`;
        }
    } else if (command === 'kill' && processName) {
        const killCommand = os.platform() === 'win32' ? `taskkill /IM ${processName} /F` : `killall ${processName}`;
            try {
            const {stdout, stderr} = await execPromise(killCommand);
            if (stderr && !stderr.includes('No matching processes found')) { // taskkill returns error even if process not found
                console.error(`Kill command stderr: ${stderr}`);
            }
            return stdout || `Successfully killed process(es) matching '${processName}'.`;
        } catch (error) {
            console.error(`Error killing process '${processName}': ${error}`);
            return `Error killing process '${processName}': ${error.message}`;
        }
    } else if (command === 'list') {
        const listCommand = os.platform() === 'win32' ? 'tasklist' : 'ps aux';
        try {
            const {stdout, stderr} = await execPromise(listCommand);
            if (stderr) {
                console.error(`List command stderr: ${stderr}`);
            }
            return stdout || 'List processes command executed successfully with no output.';
        } catch (error) {
            console.error(`Error listing processes: ${error}`);
            return `Error listing processes: ${error.message}`;
        }
    }

    return `Computer ${command} action is not fully implemented or requires necessary parameters.`;
}

export default defineTool({
    name: 'computer_use',
    description: 'Control computer processes',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'child_process', 'util', 'os'],
    invoke: invoke,
});
