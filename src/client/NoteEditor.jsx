import React, {useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';
import ReactJson from 'react-json-view';
import LogicStepEditor from './LogicStepEditor.jsx'; // Import LogicStepEditor
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-github';

export default function NoteEditor({note, onUpdate, notes = [], onRunTool, availableTools}) { // Expect availableTools as prop
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || {});
    const [priority, setPriority] = useState(note?.priority || 50);
    const [references, setReferences] = useState(note?.references || []);
    const [logic, setLogic] = useState(note?.logic || []);
    const [selectedTool, setSelectedTool] = useState(''); // State for selected tool
    const [toolInput, setToolInput] = useState({}); // State for tool input, now an object
    const [isSaving, setIsSaving] = useState(false);

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
        onUpdate({id: note.id, status: 'pending'});
    };

    const handleRunTool = () => {
        onRunTool(note.id, selectedTool, toolInput); // Use selectedTool and toolInput object
    };

    const handleContentChange = (value) => {
        handleChange('content', value.updated_src);
    };

    const handleToolSelectChange = (event) => {
        setSelectedTool(event.target.value);
        setToolInput({}); // Reset input when tool changes
    };

    const handleToolInputChange = (inputValues) => {
        setToolInput(inputValues);
    };

    const handleLogicChange = (newLogic) => {
        handleChange('logic', newLogic);
    };


    return (
        <div style={{
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            maxWidth: '800px',
            margin: '20px auto'
        }}>
            <input
                type="text"
                value={title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="Note Title"
                style={{
                    width: '100%',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '16px'
                }}
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
            <div style={{margin: '10px 0'}}>
                <label style={{marginRight: '10px'}}>Priority (0-100):</label>
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={priority}
                    onChange={e => handleChange('priority', parseInt(e.target.value) || 50)}
                    style={{width: '60px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc'}}
                />
            </div>
            <div style={{margin: '10px 0'}}>
                <label style={{marginRight: '10px'}}>References:</label>
                <select
                    multiple
                    value={references}
                    onChange={e => handleChange('references', Array.from(e.target.selectedOptions, option => option.value))}
                    style={{width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc'}}
                >
                    {notes.filter(n => n.id !== note.id).map(n => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                </select>
            </div>
            <div style={{margin: '10px 0'}}>
                <LogicStepEditor logic={logic} onChange={handleLogicChange}
                                 availableTools={availableTools}/>
            </div>

            <div style={{marginTop: '10px', marginBottom: '10px'}}>
                <label style={{marginRight: '10px'}}>Run Tool:</label>
                <select
                    value={selectedTool}
                    onChange={handleToolSelectChange}
                    style={{padding: '8px', borderRadius: '4px', marginRight: '10px'}}
                >
                    <option value="">Select a tool</option>
                    {availableTools.map(tool => (
                        <option key={tool.name} value={tool.name}>{tool.name}</option>
                    ))}
                </select>
            </div>

            {selectedTool && (
                <div style={{marginBottom: '20px', border: '1px solid #ccc', padding: '10px', borderRadius: '4px'}}>
                    <StepInput
                        step={{tool: selectedTool, input: toolInput}} // Pass tool and current input
                        availableTools={availableTools}
                        onStepChange={(index, field, value) => handleToolInputChange(value)} // Adapt onStepChange
                        index={0} // Index is not relevant here as it's not in a list
                    />
                    <button
                        onClick={handleRunTool}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginTop: '10px'
                        }}
                    >
                        Run {selectedTool}
                    </button>
                </div>
            )}


            <div style={{marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center'}}>
                <button
                    onClick={handleSave}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Save
                </button>
                <button
                    onClick={handleCancel}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleRunNow}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#2196f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Run Now
                </button>

                {isSaving && <span style={{color: '#888', fontSize: '14px'}}>Saving...</span>}
                {note && note.status && (
                    <div className={`note-status-display ${note.status}`}>
                        <strong>Status: {note.status}</strong>
                    </div>
                )}
            </div>
        </div>
    );
}
