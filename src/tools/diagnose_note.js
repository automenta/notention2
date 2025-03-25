import {z} from 'zod';
import { defineTool } from '../tool_utils.js';

const schema = z.object({
    noteId: z.string()
});

async function invoke(input, context) {
    const { noteId } = schema.parse(input);
    const note = context.graph.getNote(noteId);

    if (!note) {
        return `Error: Note with ID '${noteId}' not found.`;
    }

    const analysis = [];

    analysis.push(`**Note Title:** ${note.title}`);
    analysis.push(`**Note Status:** ${note.status}`);
    analysis.push(`**Logic Steps:** ${note.logic.length}`);
    analysis.push(`**Memory Items:** ${note.memory.length}`);
    analysis.push(`**References:** ${note.references.length}`);

    if (note.status === 'failed') {
        analysis.push("\n**Potential Issues (Note is in 'failed' status):**");
        if (note.error) {
            analysis.push(`- **Note Error:** ${note.error}`);
        }
        const stepErrors = note.memory.filter(m => m.type === 'stepError');
        if (stepErrors.length) {
            analysis.push(`- **Step Errors:**`);
            stepErrors.forEach(error => {
                analysis.push(`  - Step ID: ${error.stepId}, Error: ${error.content}`);
            });
        } else if (note.logic.length === 0 && note.status !== 'completed') {
            analysis.push("- **Note has no logic steps defined.** Is this intentional?");
        }
    } else if (note.status === 'pending') {
        analysis.push("\n**Note is 'pending' execution.**");
    } else if (note.status === 'running') {
        analysis.push("\n**Note is currently 'running'.**");
    } else if (note.status === 'completed') {
        analysis.push("\n**Note is 'completed' successfully.**");
    }

    const report = analysis.join('\n');

    // Use LLM to generate a more insightful summary (optional, for future enhancement)
    // const llmSummary = await context.llm.invoke([`Summarize this diagnostic report:\n\n${report}`]);
    // return `**Diagnostic Report for Note '${note.title}' (ID: ${noteId}):**\n\n${llmSummary.text}\n\n**Raw Details:**\n${report}`;

    return `**Diagnostic Report for Note '${note.title}' (ID: ${noteId}):**\n\n${report}`;
}

export default defineTool({
    name: 'diagnose_note',
    description: 'Diagnose a note, providing a report on its status, logic, and any errors.',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke
});
