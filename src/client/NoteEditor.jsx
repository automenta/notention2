import React, {useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';
import ReactJson from 'react-json-view';
import LogicStepEditor from './LogicStepEditor.jsx';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-github';
import {NoteEditorStyles} from './NoteEditorStyles.js'; // Import the styles

export default function NoteEditor({note, onUpdate, notes = [], onRunTool, availableTools}) {
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || {});
    const [priority, setPriority] = useState(note?.priority || 50);
    const [references, setReferences] = useState(note?.references || []);
    const [logic, setLogic] = useState(note?.logic || []);
    const [selectedTool, setSelectedTool] = useState('');
    const [toolInput, setToolInput] = useState({});
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
        switch (field) {
            case 'title':
                setTitle(value);
                break;
            case 'content':
                setContent(value);
                break;
            case 'priority':
                setPriority(value);
                break;
            case 'references':
                setReferences(value);
                break;
            case 'logic':
                setLogic(value);
                break;
            default:
                console.warn(`Unhandled field: ${field}`);
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
        onRunTool(note.id, selectedTool, toolInput);
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
        <div style={NoteEditorStyles.container}>
            <input
                type="text"
                value={title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="Note Title"
                style={NoteEditorStyles.input}
            />
            <div style={NoteEditorStyles.section}>
                <label style={NoteEditorStyles.label}>Content:</label>
                <ReactJson
                    src={content}
                    onEdit={handleContentChange}
                    onAdd={handleContentChange}
                    onDelete={handleContentChange}
                    displayObjectSize={false}
                    displayDataTypes={false}
                />
            </div>
            <div style={NoteEditorStyles.section}>
                <label style={NoteEditorStyles.label}>Priority (0-100):</label>
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={priority}
                    onChange={e => handleChange('priority', parseInt(e.target.value) || 50)}
                    style={NoteEditorStyles.numberInput}
                />
            </div>
            <div style={NoteEditorStyles.section}>
                <label style={NoteEditorStyles.label}>References:</label>
                <select
                    multiple
                    value={references}
                    onChange={e => handleChange('references', Array.from(e.target.selectedOptions, option => option.value))}
                    style={NoteEditorStyles.select}
                >
                    {notes.filter(n => n.id !== note.id).map(n => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                </select>
            </div>
            <div style={NoteEditorStyles.section}>
                <LogicStepEditor logic={logic} onChange={handleLogicChange} availableTools={availableTools}/>
            </div>

            <div style={NoteEditorStyles.section}>
                <label style={NoteEditorStyles.label}>Run Tool:</label>
                <select
                    value={selectedTool}
                    onChange={handleToolSelectChange}
                    style={NoteEditorStyles.select}
                >
                    <option value="">Select a tool</option>
                    {availableTools.map(tool => (
                        <option key={tool.name} value={tool.name}>{tool.name}</option>
                    ))}
                </select>
            </div>

            {selectedTool && (
                <div style={NoteEditorStyles.toolSection}>
                    <StepInput
                        step={{tool: selectedTool, input: toolInput}}
                        availableTools={availableTools}
                        onStepChange={(index, field, value) => handleToolInputChange(value)}
                        index={0}
                    />
                    <button
                        onClick={handleRunTool}
                        style={NoteEditorStyles.runToolButton}
                    >
                        Run {selectedTool}
                    </button>
                </div>
            )}

            <div style={NoteEditorStyles.buttonGroup}>
                <button onClick={handleSave} style={NoteEditorStyles.saveButton}>
                    Save
                </button>
                <button onClick={handleCancel} style={NoteEditorStyles.cancelButton}>
                    Cancel
                </button>
                <button onClick={handleRunNow} style={NoteEditorStyles.runNowButton}>
                    Run Now
                </button>

                {isSaving && <span style={NoteEditorStyles.saving}>Saving...</span>}
                {note && note.status && (
                    <div className={`note-status-display ${note.status}`}>
                        <strong>Status: {note.status}</strong>
                    </div>
                )}
            </div>
        </div>
    );
}
