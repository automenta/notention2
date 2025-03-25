export const INITIAL_NOTES = [
    {
        id: 'dev-1',
        title: 'Core Loop',
        content: 'Full cycle: CRUD, plan, tools',
        status: 'pending',
        tests: ['test-core-loop.js'],
        priority: 20
    },
    {
        id: 'dev-2',
        title: 'Graph UI',
        content: 'Add D3.js graph later',
        status: 'pending',
        references: ['dev-1'],
        priority: 20
    },
    {
        id: 'dev-3',
        title: 'Self-Unpacking',
        content: 'Seed generates system',
        status: 'pending',
        logic: [{id: 's1', tool: 'generateCode', input: {description: 'Note CRUD API'}}],
        tests: ['test-self-unpacking.js'],
        priority: 20
    },
    {
        id: 'dev-4',
        title: 'Tool Chaining',
        content: 'Multi-step plans with refs',
        status: 'pending',
        references: ['dev-1'],
        priority: 20
    },
    {
        id: 'seed-0',
        title: 'Netention Seed',
        content: {
            type: "system",
            desc: "Netention: Self-evolving knowledge/task fabric",
            config: {
                maxMemory: 50,
                tickRate: 10,
                decayRate: 7 * 24 * 60 * 60 * 1000,
                tokenBudget: 10000,
                defaultPriority: 50,
                replicationPeers: 5
            },
            metamodel: {
                note: {id: "string", content: "any", graph: "array", state: "object"},
                rules: ["know sub-Notes", "prune memory", "sync via IPFS", "test functionality", "learn dynamically"]
            },
            prompts: {
                "plan": "Generate a plan for: {desc}",
                "optimize": "Refine this code: {src}",
                "summarize": "Summarize: {text}",
                "eval": "Evaluate expression: {expr}",
                "graph": "Analyze graph: {nodes}",
                "test_gen": "Generate unit test for: {code}",
                "train": "Train {model} on: {data}",
                "predict": "Predict with {model}: {input}"
            },
            tools: { // tools moved inside content
                // Existing Tools
                "code_gen": {type: "tool", name: "code_gen", desc: "Generate JS", execute: "langChain.llm"},
                "file_write": {type: "tool", name: "file_write", desc: "Write IPFS", execute: "ipfs.add"},
                "reflect": {type: "tool", name: "reflect", desc: "Self-analyze", execute: "langChain.reflect"},
                "notify": {type: "tool", name: "notify", desc: "User alert", execute: "Express.push"},
                "ui_gen": {type: "tool", name: "ui_gen", desc: "Generate UI", execute: "cytoscape.add"},
                "search": {type: "tool", name: "search", desc: "Web search", execute: "langChain.serpapi"},
                "summarize": {type: "tool", name: "summarize", desc: "Text summary", execute: "langChain.summarize"},
                "know": {type: "tool", name: "know", desc: "Create Note", execute: "db.put"},
                "sync": {type: "tool", name: "sync", desc: "Replicate Notes", execute: "ipfs.pubsub"},
                "learn": {type: "tool", name: "learn", desc: "Train on data", execute: "langChain.vectorStore"},
                "eval_expr": {type: "tool", name: "eval_expr", desc: "Evaluate expressions", execute: "evalExpr"},
                "graph_search": {type: "tool", name: "graph_search", desc: "Search graph", execute: "graphSearch"},
                "graph_traverse": {
                    type: "tool",
                    name: "graph_traverse",
                    desc: "Traverse graph",
                    execute: "graphTraverse"
                },
                "graph_metrics": {type: "tool", name: "graph_metrics", desc: "Graph metrics", execute: "graphMetrics"},
                // New Testing Tools - using IDs instead of inline definitions for seed note
                "test_gen": 'tool-test_gen-id',
                "test_run": 'tool-test_run-id',
                // New Fundamental Tools - using IDs as placeholders
                "compose": 'tool-compose-id',
                "schedule": 'tool-schedule-id',
                "debug": 'tool-debug-id',
                "define_concept": 'tool-define-concept-id', // Placeholder for define_concept tool
                "update_system": 'tool-update-system-id', // Placeholder for update_system tool
                "implement_tool": 'tool-implement-tool-id' // Placeholder for implement_tool
            }
        },
        status: 'running',
        priority: 100,
        logic: [
            {
                id: '1',
                tool: 'summarize',
                input: {text: 'This is a demo of Netention, a system for active notes.'},
                dependencies: [],
                status: 'pending'
            },
            {
+                id: '13',
+                tool: 'diagnose_note', // Run diagnose_note tool on seed-0 itself
+                input: {noteId: 'seed-0'},
+                dependencies: ['12'],
+                status: 'pending'
+            },            {
                 id: '12',
                 tool: 'debug',
                 input: {noteId: 'seed-0'},
                id: '2',
                tool: 'generateCode',
                input: {description: 'Function to display summary: ${1}'},
                dependencies: ['1'],
                status: 'pending'
            },
            {
                id: '3',
                tool: 'reflect',
                input: {noteId: 'seed-0'},
                dependencies: ['2'],
                status: 'pending'
            },
            {
                id: '4',
                tool: 'test_run',
                input: {testId: 'dev-1'},
                dependencies: ['3'],
                status: 'pending'
            },
            {
                id: '5',
                tool: 'define_concept',
                input: {concept_name: 'Note', definition: 'A fundamental unit of knowledge and action in Netention.'},
                dependencies: [],
                status: 'pending'
            },
            {
                id: '6',
                tool: 'define_concept',
                input: {
                    concept_name: 'Agent',
                    definition: 'The intelligent entity associated with a Note, responsible for planning and execution.'
                },
                dependencies: [],
                status: 'pending'
            },
            {
                id: '7',
                tool: 'define_concept',
                input: {
                    concept_name: 'Plan',
                    definition: 'A graph-based representation of steps to achieve a Note\'s goal.'
                },
                dependencies: [],
                status: 'pending'
            },
            {
                id: '8',
                tool: 'define_concept',
                input: {
                    concept_name: 'Tool',
                    definition: 'External functions or modules that Agents use to interact with the world.'
                },
                dependencies: [],
                status: 'pending'
            },
            {
                id: '9',
                tool: 'debug',
                input: {noteId: 'seed-0'},
                dependencies: ['5', '6', '7', '8'], // Depend on define_concept steps
                status: 'pending'
            },
            {
                id: '10',
                tool: 'implement_tool',
                input: {
                    tool_definition: {
                        name: 'hello_world',
                        description: 'A simple tool that returns "Hello, world!" and takes a name as input',
                        code: 'async function invoke(input) { return `Hello, ${input.name}!`; }',
                        schemaDef: '{\n            name: z.string().describe(\'Name to greet\')\n        }',
                        dependencies: []
                    }
                },
                dependencies: [],
                status: 'pending'
            },
            {
                id: '11',
                tool: 'hello_world', // Use the newly implemented tool
                input: {name: 'Netention'},
                dependencies: ['10'],
                status: 'pending'
            },
            {
                id: '12',
                tool: 'debug',
                input: {noteId: 'seed-0'},
                dependencies: ['11'], // Depend on hello_world step
                status: 'pending'
            }
        ]
    },
    {
        id: 'demo-plan-1',
        title: 'Demo Plan: Summarize and Generate Code',
        content: 'Demonstrates a simple plan to summarize text and generate code.',
        status: 'pending',
        priority: 60,
        logic: [
            {
                id: 'step-1',
                tool: 'summarize',
                input: {text: 'The quick brown rabbit jumps over the lazy frogs with no effort.'},
                dependencies: [],
                status: 'pending'
            },
            {
                id: 'step-2',
                tool: 'generateCode',
                input: {description: 'Display a summary of the text: ${step-1}'},
                dependencies: ['step-1'],
                status: 'pending'
            }
        ]
    }
];
