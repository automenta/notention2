import {z} from 'zod';
import {defineTool} from '../tool_utils.js';

const schema = z.object({
    concept_name: z.string(),
    definition: z.string(),
    metaNoteId: z.string().optional() // Make metaNoteId optional
});

async function invoke(input, context) {
    const {concept_name, definition, metaNoteId: inputMetaNoteId} = schema.parse(input);
    const metaNoteId = inputMetaNoteId || 'seed-0'; // Default to 'seed-0' if not provided
    const graph = context.graph;
    const metaNote = graph.getNote(metaNoteId);

    if (!metaNote) {
        const errorMsg = `Error: Meta-Note with ID '${metaNoteId}' not found.`;
        context.logger.log(errorMsg, 'error', {component: 'define_concept', metaNoteId: metaNoteId});
        return errorMsg;
    }

    if (!metaNote.content || typeof metaNote.content !== 'object') {
        metaNote.content = {}; // Initialize content if it's not an object
    }

    if (!metaNote.content.concepts || typeof metaNote.content.concepts !== 'object') {
        metaNote.content.concepts = {}; // Initialize concepts if it doesn't exist
    }

    if (!metaNote.content.concepts) {
        metaNote.content.concepts = {};
    }

    metaNote.content.concepts[concept_name] = {
        definition: definition,
        createdAt: new Date().toISOString()
    };

    await context.serverCore.writeNoteToDB(metaNote);

    const successMsg = `Concept '${concept_name}' defined and stored in Meta-Note.`;
    context.logger.log(successMsg, 'info', {component: 'define_concept', conceptName: concept_name});
    return {status: 'success', message: successMsg, conceptName: concept_name};
}

export default defineTool({
    name: 'define_concept',
    description: 'Defines a core concept within Netention and stores its definition in the Meta-Note',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    invoke: invoke,
});
