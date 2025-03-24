import React, { useEffect, useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import ReactJson from 'react-json-view';
import LogicStepEditor from './LogicStepEditor.jsx'; // Import LogicStepEditor
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-github';

export default function NoteEditor({ note, onUpdate, notes = [], onRunTool }) {
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || {});
    const [priority, setPriority] = useState(note?.priority || 50);
    const [references, setReferences] = useState(note?.references || []);
    const [logic, setLogic] = useState(note?.logic || []);
    const [toolInput, setToolInput] = useState({ tool: '', input: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [availableTools, setAvailableTools] = useState([
        { name: 'summarize', description: 'Summarize text', schema: { type: 'object', properties: { text: { type: 'string', description: 'Text to summarize' }, length: { type: 'string', enum: ['short', 'medium', 'long'], description: 'Summary length' } }, required: ['text'] } },
        { name: 'generateCode', description: 'Generate code', schema: { type: 'object', properties: { description: { type: 'string', description: 'Code description' } }, required: ['description'] } },
        { name: 'reflect', description: 'Reflect', schema: { type: 'object', properties: { noteId: { type: 'string', description: 'Note ID to reflect on' } }, required: ['noteId'] } },
        { name: 'test_gen', description: 'Generate tests', schema: { type: 'object', properties: { code: { type: 'string', description: 'Code to test' }, targetId: { type: 'string', description: 'Target Note ID' } }, required: ['code', 'targetId'] } },
        { name: 'test_run', description: 'Run tests', schema: { type: 'object', properties: { testId: { type: 'string', description: 'Test Note ID' } }, required: ['testId'] } },
        { name: 'compose', description: 'Compose tools', schema: { type: 'object', properties: { tools: { type: 'array', items: { type: 'string' }, description: 'Tools to compose' }, inputs: { type: 'object', description: 'Initial inputs' } }, required: ['tools', 'inputs'] } },
        { name: 'schedule', description: 'Schedule note', schema: { type: 'object', properties: { noteId: { type: 'string', description: 'Note ID to schedule' }, time: { type: 'string', format: 'datetime', description: 'Schedule time' } }, required: ['noteId', 'time'] } },
        { name: 'debug', description: 'Debug note', schema: { type: 'object', properties: { noteId: { type: 'string', description: 'Note ID to debug' } }, required: ['noteId'] } },
        { name: 'eval_expr', description: 'Evaluate expression', schema: { type: 'object', properties: { expr: { type: 'string', description: 'Expression to evaluate' }, context: { type: 'object', description: 'Context for evaluation' } }, required: ['expr'] } },
        { name: 'graph_metrics', description: 'Graph metrics', schema: { type: 'object', properties: { startId: { type: 'string', description: 'Start Note ID' } }, required: ['startId'] } },
        { name: 'graph_search', description: 'Graph search', schema: { type: 'object', properties: { startId: { type: 'string', description: 'Start Note ID' }, query: { type: 'string', description: 'Search query' } }, required: ['startId', 'query'] } },
        { name: 'graph_traverse', description: 'Graph traverse', schema: { type: 'object', properties: { startId: { type: 'string', description: 'Start Note ID' }, mode: { type: 'string', enum: ['dfs', 'bfs'], default: 'bfs', description: 'Traversal mode' }, callback: { type: 'string', description: 'Callback function' } }, required: ['startId'] } },
        { name: 'knowNote', description: 'Create note', schema: { type: 'object', properties: { title: { type: 'string', description: 'New note title' }, goal: { type: 'string', description: 'New note goal' } }, required: ['title', 'goal'] } },
        { name: 'ml_predict', description: 'ML predict', schema: { type: 'object', properties: { modelId: { type: 'string', description: 'Model Note ID' }, input: { type: 'object', description: 'Prediction input' } }, required: ['modelId', 'input'] } },
        { name: 'ml_train', description: 'ML train', schema: { type: 'object', properties: { modelType: { type: 'string', enum: ['dtree', 'classifier', 'pca', 'cluster'], description: 'Model type' }, data: { type: 'array', items: { type: 'object' }, description: 'Training data' }, targetId: { type: 'string', description: 'Target Note ID' } }, required: ['modelType', 'data'] } },
        { name: 'rag', description: 'RAG query', schema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, documents: { type: 'array', items: { type: 'string' }, description: 'Documents' }, vectorStoreId: { type: 'string', description: 'Vector store ID' } }, required: ['query'] } },
        { name: 'webSearch', description: 'Web search', schema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, apiKey: { type: 'string', description: 'API key' } }, required: ['query'] } },
        { name: 'fetchExternal', description: 'Fetch external data', schema: { type: 'object', properties: { apiName: { type: 'string', description: 'API name' }, query: { type: 'string', description: 'API query' } }, required: ['apiName', 'query'] } },
        { name: 'analyze', description: 'Analyze note', schema: { type: 'object', properties: { targetId: { type: 'string', description: 'Target Note ID' } }, required: ['targetId'] } },
        { name: 'browser_use', description: 'Browser use', schema: { type: 'object', properties: { url: { type: 'string', format: 'url', description: 'URL to browse' }, action: { type: 'string', enum: ['open', 'scrape', 'interact'], description: 'Browser action' }, selector: { type: 'string', description: 'CSS selector' }, input: { type: 'string', description: 'Input value' } }, required: ['url', 'action'] } },
        { name: 'computer_monitor', description: 'Computer monitor', schema: { type: 'object', properties: { metric: { type: 'string', enum: ['cpu', 'memory', 'disk', 'network'], description: 'Metric to monitor' }, interval: { type: 'number', description: 'Monitoring interval' } }, required: ['metric'] } },
        { name: 'computer_use', description: 'Computer use', schema: { type: 'object', properties: { command: { type: 'string', enum: ['run', 'kill', 'list'], description: 'Computer command' }, process: { type: 'string', description: 'Process name' }, script: { type: 'string', description: 'Script to run' } }, required: ['command'] } },
        { name: 'mcp', description: 'MCP task', schema: { type: 'object', properties: { task: { type: 'string', description: 'MCP task description' }, constraints: { type: 'object', description: 'Task constraints' } }, required: ['task'] } },
    ]);


    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setContent(note.content || {});
            setPriority(note.priority || 50);
            setReferences(note.references || []);
            setLogic(note.logic || []);
        }
    }, [note]);

    const debouncedSave = useCallback(
        debounce((newTitle, newContent, newPriority, newReferences, newLogic) => {
            setIsSaving(true);
            onUpdate({
                id: note.id,
                title: newTitle,
                content: newContent,
                priority: newPriority,
                references: newReferences,
                logic: newLogic
            }).then(() => setIsSaving(false));
        }, 1000),
        [note.id, onUpdate]
    );

    const handleChange = (field, value) => {
        if (field === 'title') setTitle(value);
        if (field === 'content') setContent(value);
        if (field === 'priority') setPriority(value);
        if (field === 'references') setReferences(value);
        if (field === 'logic') {
            setLogic(value);
            value = value;
        }
        debouncedSave(
            field === 'title' ? value : title,
            field === 'content' ? value : content,
            field === 'priority' ? value : priority,
            field === 'references' ? value : references,
            field === 'logic' ? value : logic
        );
    };

    const handleSave = () => {
        debouncedSave.flush();
    };

    const handleCancel = () => {
        setTitle(note.title);
        setContent(note.content || {});
        setPriority(note.priority || 50);
        setReferences(note.references || []);
        setLogic(note.logic || []);
        debouncedSave.cancel();
        setIsSaving(false);
    };

    const handleRunNow = () => {
        onUpdate({ id: note.id, status: 'pending' });
    };

    const handleRunTool = () => {
        onRunTool(note.id, toolInput.tool, JSON.parse(toolInput.input || '{}'));
    };

    const handleContentChange = (value) => {
        handleChange('content', value.updated_src);
    };

    const handleLogicChange = (newLogic) => {
        handleChange('logic', newLogic);
    };


    return (
        <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', maxWidth: '800px', margin: '20px auto' }}>
            <input
                type="text"
                value={title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="Note Title"
                style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '16px' }}
            />
            <div style={{ marginBottom: '10px' }}>
                <label style={{ marginRight: '10px' }}>Content:</label>
                <ReactJson
                    src={content}
                    onEdit={handleContentChange}
                    onAdd={handleContentChange}
                    onDelete={handleContentChange}
                    displayObjectSize={false}
                    displayDataTypes={false}
                />
            </div>
            <div style={{ margin: '10px 0' }}>
                <label style={{ marginRight: '10px' }}>Priority (0-100):</label>
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={priority}
                    onChange={e => handleChange('priority', parseInt(e.target.value) || 50)}
                    style={{ width: '60px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
            </div>
            <div style={{ margin: '10px 0' }}>
                <label style={{ marginRight: '10px' }}>References:</label>
                <select
                    multiple
                    value={references}
                    onChange={e => handleChange('references', Array.from(e.target.selectedOptions, option => option.value))}
                    style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                    {notes.filter(n => n.id !== note.id).map(n => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                </select>
            </div>
            <div style={{ margin: '10px 0' }}>
                <LogicStepEditor logic={logic} onChange={handleLogicChange} availableTools={availableTools} />
            </div>
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                    onClick={handleSave}
                    style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Save
                </button>
                <button
                    onClick={handleCancel}
                    style={{ padding: '8px 16px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleRunNow}
                    style={{ padding: '8px 16px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Run Now
                </button>
                <button
                    onClick={handleRunTool}
                    style={{ padding: '8px 16px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Run Tool
                </button>
                {isSaving && <span style={{ color: '#888', fontSize: '14px' }}>Saving...</span>}
            </div>
        </div>
    );
}
