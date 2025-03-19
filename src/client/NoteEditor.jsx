import React, {useEffect, useState} from 'react';

export default function NoteEditor({note, onUpdate, onRun}) {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content || ''); // Ensure content is never undefined
    const [isSaving, setIsSaving] = useState(false);
    const [runStatus, setRunStatus] = useState('');

    useEffect(() => {
        setTitle(note.title);
        setContent(note.content || '');
    }, [note]);

    useEffect(() => {
        if (note.status === 'running') {
            setRunStatus('Running...');
        } else if (note.status === 'completed') {
            setRunStatus('Completed');
        } else if (note.status === 'failed') {
            setRunStatus('Failed!');
        } else {
            setRunStatus('');
        }
    }, [note.status]);

    const handleSave = async () => {
        setIsSaving(true);
        await onUpdate({ id: note.id, title, content, logic: [{ id: crypto.randomUUID(), tool: 'summarize', input: { text: content }, status: 'pending' }] });
        setIsSaving(false);
        onRun(note.id); // Trigger LM processing immediately
    };

    return (
        <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '20px' }}>
            <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note Title"
                style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
            />
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your note here..."
                style={{ width: '100%', height: '100px', padding: '8px', marginBottom: '10px' }}
            />
            <div style={{ marginBottom: '10px' }}>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                        padding: '5px 10px',
                        marginRight: '10px',
                        background: isSaving ? '#cccccc' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isSaving ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isSaving ? 'Saving...' : 'Save and Summarize'}
                </button>
                <button
                    onClick={() => onRun(note.id)}
                    style={{ padding: '5px 10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    Re-run
                </button>
                {runStatus && <span style={{ marginLeft: '10px' }}>{runStatus}</span>}
            </div>
            {note.memory.length > 0 && (
                <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '4px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Result:</h4>
                    <p>{note.memory[note.memory.length - 1].content}</p>
                </div>
            )}
        </div>
    );
}
