import {z} from 'zod';

const schema = z.object({
    concept_name: z.string(),
    definition: z.string()
});

export default {
    name: 'define_concept',
    description: 'Defines a core concept within Netention and stores its definition in the Meta-Note',
    schema,
    version: '1.0.0',
    dependencies: ['zod'],
    async invoke(input, context) {
        const {concept_name, definition} = schema.parse(input);
        const metaNoteId = 'seed-0'; // Assuming 'seed-0' is the ID of the Meta-Note
        const metaNote = context.graph.getNote(metaNoteId);

        if (!metaNote) {
            const errorMsg = `Error: Meta-Note with ID '${metaNoteId}' not found.`;
            context.log(errorMsg, 'error', { component: 'define_concept', metaNoteId: metaNoteId });
            return errorMsg;
        }

        if (!metaNote.content || typeof metaNote.content !== 'object') {
            metaNote.content = {}; // Initialize content if it's not an object
        }

        if (!metaNote.content.concepts || typeof metaNote.content.concepts !== 'object') {
            metaNote.content.concepts = {}; // Initialize concepts if it doesn't exist
        }

        metaNote.content.concepts[concept_name] = definition;

        await context.graph.writeNoteToDB(metaNote); // Persist changes to Meta-Note

        const successMsg = `Concept '${concept_name}' defined and stored in Meta-Note.`;
        context.log(successMsg, 'info', { component: 'define_concept', conceptName: concept_name });
        return successMsg;
    }
};
