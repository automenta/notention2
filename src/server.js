import {WebSocketServer} from 'ws';
import {InMemoryChatMessageHistory} from '@langchain/core/chat_history';
import {ChatGoogleGenerativeAI} from '@langchain/google-genai';
import {readdir, readFile, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import * as fs from "node:fs";
import react from '@vitejs/plugin-react';
import {createViteServer} from "vitest/node";
import * as http from "node:http";

// Note schema
const Note = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'running', 'completed']).default('pending'),
    logic: z.array(z.object({id: z.string(), tool: z.string(), input: z.any()})).optional(),
    memory: z.array(z.any()).default([]),
    references: z.array(z.string()).default([]),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
    updatedAt: z.string().datetime().nullable().default(null),
});

// Filesystem indices
const NOTES_DIR = '../notes';
const TOOLS_BUILTIN_DIR = 'tools';
const TOOLS_DIR = '../tools';
const TESTS_DIR = 'tests';
const GEN_DIR = 'generated';

// Development & seed notes
const devNotes = [
    {
        id: 'dev-1',
        title: 'Core Loop',
        content: 'Full cycle: CRUD, plan, tools',
        status: 'pending',
        tests: ['test-core-loop.js']
    },
    {id: 'dev-2', title: 'Graph UI', content: 'Add D3.js graph later', status: 'pending', references: ['dev-1']},
    {
        id: 'dev-3',
        title: 'Self-Unpacking',
        content: 'Seed generates system',
        status: 'pending',
        logic: [{id: 's1', tool: 'generateCode', input: {description: 'Note CRUD API'}}],
        tests: ['test-self-unpacking.js']
    },
    {
        id: 'dev-4',
        title: 'Tool Chaining',
        content: 'Multi-step plans with refs',
        status: 'pending',
        references: ['dev-1']
    },
];
const seedNote = {
    id: 'seed-0',
    title: 'Netention Seed',
    content: 'Bootstrap: CRUD, tools, plans',
    status: 'running',
    logic: [{id: 's1', tool: 'generateCode', input: {description: 'Note management functions'}}]
};

// Server state
//const llm = new ChatOpenAI({openAIApiKey: process.env.OPENAI_API_KEY, temperature: 0.7});
const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 1, maxRetries: 2});
const notes = new Map();
const tools = new Map();
const memory = new InMemoryChatMessageHistory();

// Load from filesystem
async function loadNotes() {
    fs.mkdirSync(NOTES_DIR, {recursive: true});
    const files = await readdir(NOTES_DIR);
    for (const file of files) {
        const data = JSON.parse(await readFile(join(NOTES_DIR, file), 'utf8'));
        notes.set(data.id, Note.parse(data));
    }
    if (!notes.size) {
        devNotes.concat(seedNote).forEach(n => {
            const note = Note.parse({...n, createdAt: new Date().toISOString()});
            notes.set(note.id, note);
            writeFile(join(NOTES_DIR, `${note.id}.json`), JSON.stringify(note));
        });
    }
}

async function loadTools(path) {
    const files = await readdir(path);
    for (const file of files) {
        let i = "./" + path + "/" + file;
        const {default: tool} = await import(i);
        tools.set(file.replace('.js', ''), tool);
    }
}

// Core loop with anticipation
async function runNote(noteId) {
    const note = notes.get(noteId);
    if (!note) return null;
    note.status = 'running';
    note.updatedAt = new Date().toISOString();
    await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
    try {
        await memory.addMessage({role: 'user', content: `${note.title}: ${note.content}`});
        const refs = note.references.map(id => notes.get(id)).filter(Boolean);

        if (!note.logic?.length) {
            const previousMessages = await memory.getMessages();
            const systemPrompt = {
                role: 'system',
                content: `Generate JSON plan: { id, tool, input } steps. Anticipate using refs: ${JSON.stringify(refs.map(r => ({
                    id: r.id,
                    title: r.title,
                    content: r.content
                })))}`
            };
            const messages = [...previousMessages, systemPrompt];
            const plan = await llm.invoke(messages);
            note.logic = JSON.parse(plan.content);
            note.memory.push({type: 'system', content: 'Plan generated', timestamp: Date.now()});
        }

        for (const step of note.logic) {
            const tool = tools.get(step.tool);
            if (tool) {
                const result = await tool.invoke(step.input);
                note.memory.push({type: 'tool', content: result, timestamp: Date.now()});
                await memory.addMessage({role: 'assistant', content: JSON.stringify(result)});
                const nextStep = note.logic[note.logic.indexOf(step) + 1];
                if (nextStep) nextStep.input = result;
            }
        }
        note.status = 'completed';
    } catch (err) {
        note.status = 'pending';
        note.memory.push({type: 'error', content: err.message, timestamp: Date.now()});
    }
    note.updatedAt = new Date().toISOString();
    await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
    return note;
}

async function startServer() {
    // Create Vite dev server in middleware mode
    const vite = await createViteServer({
        root: "client",
        plugins: [react()],
        server: {
            middlewareMode: true, // Use Vite as middleware instead of standalone server
        },
    });

    // Create HTTP server
    const httpServer = http.createServer((req, res) => {
        // Pass request through Vite's middleware
        vite.middlewares.handle(req, res);
    });

    // Attach WebSocket server to the same HTTP server
    const wss = new WebSocketServer({server: httpServer});

    wss.on('connection', async (ws) => {
        ws.send(JSON.stringify({type: 'notes', data: [...notes.values()]}));

        ws.on('message', async (msg) => {
            const {type, ...data} = JSON.parse(msg);

            if (type === 'createNote') {
                const id = crypto.randomUUID();
                const note = Note.parse({id, title: data.title, content: '', createdAt: new Date().toISOString()});
                notes.set(id, note);
                await writeFile(join(NOTES_DIR, `${id}.json`), JSON.stringify(note));
            }

            if (type === 'updateNote') {
                const note = notes.get(data.id);
                if (note) {
                    const updated = Note.parse({...note, ...data, updatedAt: new Date().toISOString()});
                    notes.set(data.id, updated);
                    await writeFile(join(NOTES_DIR, `${data.id}.json`), JSON.stringify(updated));
                }
            }

            if (type === 'deleteNote') {
                notes.delete(data.id);
                await unlink(join(NOTES_DIR, `${data.id}.json`)).catch(() => {
                });
            }

            if (type === 'runNote') {
                const updated = await runNote(data.id);
                if (updated) notes.set(data.id, updated);
            }

            wss.clients.forEach(client =>
                client.send(JSON.stringify({type: 'notes', data: [...notes.values()]}))
            );
        });
    });

    // Start the combined server
    const PORT = 8080;
    httpServer.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT} (HTTP + WebSocket)`);
    });

    return {vite, httpServer, wss};
}


// Start the server
startServer().catch(console.error);


// Self-unpacking bootstrap
await loadNotes();

await loadTools(TOOLS_BUILTIN_DIR);

fs.mkdirSync(TOOLS_DIR, {recursive: true});
await loadTools(TOOLS_DIR);

if (notes.has('seed-0')) {
    const seed = await runNote('seed-0');
    console.log('Seed unpacked:', seed.memory);
}

// Self-reflection
setInterval(async () => {
    for (const [id, note] of notes) {
        if (note.status === 'completed' && note.memory.length > 5) {
            const summary = await tools.get('summarize')?.invoke(note.memory.map(m => m.content).join(''));
            note.memory = [{type: 'system', content: summary, timestamp: Date.now()}];
            await writeFile(join(NOTES_DIR, `${id}.json`), JSON.stringify(note));
        }
    }
}, 30000);


// Export for Vite config
export default {
    plugins: [react()]
};
