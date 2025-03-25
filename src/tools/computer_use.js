import {z} from 'zod';

import {z} from 'zod';
import {exec} from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

const schema = z.object({
    command: z.enum(['run', 'kill', 'list']),
    command_string: z.string().optional(), // Add command_string for 'run' command
    process: z.string().optional(),
    script: z.string().optional(),
});

export default {
    name: 'computer_use',
    description: 'Control computer processes',
    schema,
    version: '1.0.0',
    dependencies: ['zod', 'child_process', 'util'],
    async invoke(input) {
        const {command, command_string} = schema.parse(input);

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
        }

        return `Computer ${command} action is not fully implemented or requires 'command_string' for 'run' action.`;
    }
};
