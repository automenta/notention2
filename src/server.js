import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import express from 'express';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";


// Directory constants
const NOTES_DIR = './data/notes';
const TOOLS_DIR = './tools/user';
const TOOLS_BUILTIN_DIR = './tools/builtin';

// Initialize directories if they don’t exist
if (!existsSync(NOTES_DIR)) mkdirSync(NOTES_DIR, { recursive: true });
if (!existsSync(TOOLS_DIR)) mkdirSync(TOOLS_DIR, { recursive: true });
if (!existsSync(TOOLS_BUILTIN_DIR)) mkdirSync(TOOLS_BUILTIN_DIR, { recursive: true });

// Tool registry
const tools = new Map();

// Note schema with enhanced fields
const Note = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
    logic: z.array(z.object({
        id: z.string(),
        tool: z.string(),
        input: z.any(),
        dependencies: z.array(z.string()).default([]),
        status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
    })).optional(),
    memory: z.array(z.object({
        type: z.string(),
        content: z.any(),
        timestamp: z.number(),
    })).default([]),
    references: z.array(z.string()).default([]),
    domains: z.array(z.string()).default([]), // Domain tagging
    deadline: z.string().datetime().nullable().default(null), // Deadlines
    priority: z.number().int().default(0), // Priority
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
    updatedAt: z.string().datetime().nullable().default(null),
});

// In-memory note storage
const notes = new Map();

// LLM instance
const llm = new ChatGoogleGenerativeAI({model: "gemini-2.0-flash", temperature: 0.7, maxRetries: 3});
const memory = { getMessages: async () => [] }; // Placeholder for memory context

// Load tools dynamically from a directory
async function loadToolsFromDir(dir) {
    try {
        const files = await readdir(dir);
        for (const file of files) {
            if (file.endsWith('.js')) {
                const toolModule = await import(join(dir, file));
                const tool = toolModule.default;
                tools.set(tool.name, tool);
                console.log(`Loaded tool: ${tool.name} from ${dir}`);
            }
        }
    } catch (error) {
        console.error(`Error loading tools from ${dir}:`, error);
    }
}

// Load both built-in and user-defined tools
async function loadTools() {
    await loadToolsFromDir(TOOLS_BUILTIN_DIR);
    await loadToolsFromDir(TOOLS_DIR);
}

// Load existing notes from disk
function loadNotes() {
    const files = readdirSync(NOTES_DIR);
    for (const file of files) {
        if (file.endsWith('.json')) {
            const noteData = JSON.parse(readFileSync(join(NOTES_DIR, file), 'utf-8'));
            const note = Note.parse(noteData);
            notes.set(note.id, note);
        }
    }
}

// Execute a tool step with error handling
async function executeToolStep(step, note, outputs) {
    const tool = tools.get(step.tool);
    if (!tool) throw new Error(`Tool ${step.tool} not found`);
    
    const input = JSON.parse(JSON.stringify(step.input), (key, value) => {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
            const depId = value.slice(2, -1);
            return outputs.get(depId) ?? value;
        }
        return value;
    });

    try {
        step.status = 'running';
        const result = await tool.execute(input);
        step.status = 'completed';
        outputs.set(step.id, result);
        note.memory.push({ type: 'tool_result', content: result, timestamp: Date.now() });
    } catch (error) {
        step.status = 'failed';
        note.memory.push({ type: 'error', content: error.message, timestamp: Date.now() });
        throw error;
    }
}

// Run a note’s plan
async function runNote(noteId) {
    const note = notes.get(noteId);
    if (!note) throw new Error(`Note ${noteId} not found`);
    if (note.status !== 'pending') return;

    note.status = 'running';
    await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));

    // Generate plan if not provided
    if (!note.logic || note.logic.length === 0) {
        const memorySummary = note.memory.map(m => `${m.type}: ${m.content}`).join('\n');
        const systemPrompt = {
            role: 'system',
            content: `You are an AI assistant generating a plan for an active note in the Netention system. Note details:
- Title: ${note.title}
- Content: ${note.content}
- References: ${note.references.map(ref => notes.get(ref)?.title || 'Unknown').join(', ')}
- Memory: ${memorySummary}

Generate a JSON plan with steps: { id, tool, input, dependencies }. Available tools: ${Array.from(tools.keys()).join(', ')}.
Consider:
1. The main goal based on content and memory.
2. Appropriate tools to achieve the goal.
3. Dependencies between steps.
4. Anticipate failures and suggest contingencies (e.g., alternative steps).

Default to [{"id": "1", "tool": "summarize", "input": {"text": "Note content"}, "dependencies": []}] if no specific plan is needed.`
        };
        const response = await llm.invoke([systemPrompt, ...await memory.getMessages()]);
        note.logic = JSON.parse(response.content);
    }

    // Execute the plan
    const outputs = new Map();
    while (note.logic.some(step => step.status === 'pending')) {
        const step = note.logic.find(s => s.status === 'pending' && s.dependencies.every(d => outputs.has(d)));
        if (!step) break;

        try {
            await executeToolStep(step, note, outputs);
        } catch (error) {
            note.status = 'failed';
            break;
        }
    }

    note.status = note.logic.every(s => s.status === 'completed') ? 'completed' : 'failed';
    note.updatedAt = new Date().toISOString();

    // Reflect on execution for self-improvement
    const reflectionPrompt = {
        role: 'system',
        content: `Reflect on the execution of the plan for note "${note.title}". Status: "${note.status}". Analyze what went well and what could be improved. Suggest optimizations for future plans.`
    };
    const reflection = await llm.invoke([reflectionPrompt, ...await memory.getMessages()]);
    note.memory.push({ type: 'reflection', content: reflection.content, timestamp: Date.now() });

    await writeFile(join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note));
}

// Express server setup
const app = express();
app.use(express.json());

// API: Get all notes
app.get('/notes', (req, res) => {
    res.json([...notes.values()]);
});

// API: Create or update a note
app.post('/notes', async (req, res) => {
    const noteData = req.body;
    const note = Note.parse({
        ...noteData,
        id: noteData.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
    notes.set(note.id, note);
    await writeFile(join(NOTES_DIR, `${note.id}.json`), JSON.stringify(note));
    res.json(note);
});

// API: Run a note
app.post('/notes/:id/run', async (req, res) => {
    try {
        await runNote(req.params.id);
        res.json(notes.get(req.params.id));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Scheduler: Run pending notes based on priority
setInterval(async () => {
    const pendingNotes = [...notes.values()]
        .filter(n => n.status === 'pending')
        .sort((a, b) => b.priority - a.priority || new Date(a.deadline || Infinity) - new Date(b.deadline || Infinity));
    for (const note of pendingNotes) {
        await runNote(note.id);
    }
}, 10000); // Check every 10 seconds

// Start the server
async function startServer() {
    await loadTools();
    loadNotes();
    app.listen(3000, () => console.log('Server running on port 3000'));
}

startServer().catch(console.error);
