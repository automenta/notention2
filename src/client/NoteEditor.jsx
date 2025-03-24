import React, { useEffect, useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import ReactJson from 'react-json-view';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-github';

export default function NoteEditor({ note, onUpdate, notes = [], onRunTool }) {
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || {}); // Changed to object
    const [priority, setPriority] = useState(note?.priority || 50);
    const [references, setReferences] = useState(note?.references || []);
    const [logic, setLogic] = useState(note?.logic || []);
    const [toolInput, setToolInput] = useState({ tool: '', input: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [logicCode, setLogicCode] = useState(''); // State for code editor

    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setContent(note.content || {}); // Changed to object
            setPriority(note.priority || 50);
            setReferences(note.references || []);
            setLogic(note.logic || []);
            setLogicCode(JSON.stringify(note.logic, null, 2) || ''); // Initialize code editor with logic
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
            try {
                const parsedLogic = JSON.parse(value);
                setLogic(parsedLogic);
                setLogicCode(value); // Update code editor value
                value = parsedLogic; // For debouncedSave to use parsed logic object
            } catch (e) {
                console.error("Error parsing logic JSON:", e);
                return; // Do not save if JSON is invalid
            }
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
        setContent(note.content || {}); // Changed to object
        setPriority(note.priority || 50);
        setReferences(note.references || []);
        setLogic(note.logic || []);
        setLogicCode(JSON.stringify(note.logic, null, 2) || ''); // Reset code editor on cancel
        debouncedSave.cancel();
        setIsSaving(false);
    };

    const handleRunNow = () => {
        onUpdate({ id: note.id, status: 'pending' });
    };

    const handleAddStep = () => {
        const newStep = {
            id: `step-${Date.now()}`,
            tool: toolInput.tool,
            input: JSON.parse(toolInput.input || '{}'),
            dependencies: [],
            status: 'pending'
        };
        handleChange('logic', [...logic, newStep]);
        setToolInput({ tool: '', input: '' });
    };

    const handleRunTool = () => {
        onRunTool(note.id, toolInput.tool, JSON.parse(toolInput.input || '{}'));
    };

    const handleContentChange = (value) => {
        handleChange('content', value.updated_src);
    };

    const handleLogicCodeChange = (value) => {
        setLogicCode(value);
        handleChange('logic', value); // Parse JSON and update logic state
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
            <div style={{marginBottom: '10px'}}>
                <label style={{marginRight: '10px'}}>Content:</label>
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
                <label style={{ marginRight: '10px' }}>Logic Steps:</label>
                <AceEditor
                    mode="javascript"
                    theme="github"
                    value={logicCode}
                    onChange={handleLogicCodeChange}
                    name="logic-editor"
                    editorProps={{ $blockScrolling: true }}
                    style={{ width: '100%', height: '200px' }}
                />

            </div>
             {/* Existing Logic Step UI - Consider removing or integrating with code editor */}
             {/*
            <div style={{ margin: '10px 0' }}>
                <label style={{ marginRight: '10px' }}>Logic Steps:</label>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {logic.map(step => (
                        <li key={step.id} style={{ marginBottom: '5px' }}>
                            {step.tool} - {JSON.stringify(step.input)} ({step.status})
                            <button
                                onClick={() => handleChange('logic', logic.filter(s => s.id !== step.id))}
                                style={{ marginLeft: '10px', padding: '2px 8px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <input
                        type="text"
                        value={toolInput.tool}
                        onChange={e => setToolInput({ ...toolInput, tool: e.target.value })}
                        placeholder="Tool Name"
                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
                    />
                    <input
                        type="text"
                        value={toolInput.input}
                        onChange={e => setToolInput({ ...toolInput, input: e.target.value })}
                        placeholder='{"key": "value"}'
                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', flex: 2 }}
                    />
                    <button
                        onClick={handleAddStep}
                        style={{ padding: '5px 10px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        Add Step
                    </button>
                </div>
            </div>
            */}
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
