import React, {useState} from 'react';

export default function NoteEditor({note, onUpdate, onRun}) {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content);
    const [tool, setTool] = useState('');
    const [refId, setRefId] = useState('');

    const save = () => onUpdate({id: note.id, title, content});
    const run = () => onRun(note.id);
    const addTool = () => onUpdate({
        id: note.id,
        logic: [...(note.logic || []), {id: crypto.randomUUID(), tool, input: content}]
    });
    const addRef = () => onUpdate({
        id: note.id,
        references: [...(note.references || []), refId]
    });
    const updateStep = (stepId, input) => onUpdate({
        id: note.id,
        logic: note.logic.map(s => s.id === stepId ? {...s, input} : s)
    });

    return (
        <div>
            <input value={title} onChange={e => setTitle(e.target.value)}/>
            <textarea value={content} onChange={e => setContent(e.target.value)}/>
            <button onClick={save}>Save</button>
            <button onClick={run}>Run</button>
            <select value={tool} onChange={e => setTool(e.target.value)}>
                <option value="">Add Tool</option>
                <option value="summarize">Summarize</option>
                <option value="webSearch">Web Search</option>
                <option value="generateCode">Generate Code</option>
            </select>
            <button onClick={addTool} disabled={!tool}>Add</button>
            <input value={refId} onChange={e => setRefId(e.target.value)} placeholder="Ref ID"/>
            <button onClick={addRef} disabled={!refId}>Add Ref</button>
            <h3>Plan</h3>
            {note.logic?.map(step => (
                <div key={step.id}>
                    {step.tool}: <input value={step.input} onChange={e => updateStep(step.id, e.target.value)}/>
                </div>
            ))}
            <h3>Memory</h3>
            <pre>{JSON.stringify(note.memory, null, 2)}</pre>
        </div>
    );
}