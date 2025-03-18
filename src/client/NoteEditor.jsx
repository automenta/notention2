import React, {useEffect, useState} from 'react';

export default function NoteEditor({note, onUpdate, onRun}) {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content);
    const [tool, setTool] = useState('');
    const [refId, setRefId] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        setTitle(note.title);
        setContent(note.content);
        setError(null);
    }, [note]);

    const save = () => {
        try {
            onUpdate({id: note.id, title, content});
        } catch (err) {
            setError('Failed to save note');
        }
    };
    const run = () => onRun(note.id);
    const addTool = () => {
        try {
            onUpdate({
                id: note.id,
                logic: [...(note.logic || []), {id: crypto.randomUUID(), tool, input: content}]
            });
            setTool('');
        } catch (err) {
            setError('Failed to add tool');
        }
    };
    const addRef = () => onUpdate({
        id: note.id,
        references: [...(note.references || []), refId]
    });
    const updateStep = (stepId, input) => onUpdate({
        id: note.id,
        logic: note.logic.map(s => s.id === stepId ? {...s, input} : s)
    });

    return (
        <div style={{padding: '10px', border: '1px solid #ccc'}}>
            {error && <p style={{color: 'red'}}>{error}</p>}
            <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{width: '100%', marginBottom: '10px'}}
            />
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                style={{width: '100%', height: '100px', marginBottom: '10px'}}
            />
            <button onClick={save} style={{marginRight: '5px'}}>Save</button>
            <button onClick={run} style={{marginRight: '5px'}}>Run</button>
            <select value={tool} onChange={e => setTool(e.target.value)} style={{marginRight: '5px'}}>
                <option value="">Add Tool</option>
                <option value="summarize">Summarize</option>
                <option value="webSearch">Web Search</option>
                <option value="generateCode">Generate Code</option>
            </select>
            <button onClick={addTool} disabled={!tool}>Add</button>
            <input
                value={refId}
                onChange={e => setRefId(e.target.value)}
                placeholder="Ref ID"
                style={{margin: '10px 5px 0 0'}}
            />
            <button onClick={addRef} disabled={!refId}>Add Ref</button>
            <h3>Plan</h3>
            {note.logic?.map(step => (
                <div key={step.id} style={{margin: '5px 0'}}>
                    {step.tool}: <input
                    value={step.input}
                    onChange={e => updateStep(step.id, e.target.value)}
                    style={{width: '70%'}}
                />
                </div>
            ))}
            <h3>Memory</h3>
            <pre>{JSON.stringify(note.memory, null, 2)}</pre>
        </div>
    );
}
