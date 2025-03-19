import React, {useEffect, useState} from 'react';
import crypto from 'crypto';

export default function NoteEditor({note, onUpdate, onRun}) {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content || '');
    const [isSaving, setIsSaving] = useState(false);
    const [runStatus, setRunStatus] = useState('');

    useEffect(() => {
        setTitle(note.title);
        setContent(note.content || '');
    }, [note]);

    useEffect(() => {
        setRunStatusBasedOnNoteStatus(note.status);
    }, [note.status]);

    const setRunStatusBasedOnNoteStatus = (status) => {
        switch (status) {
            case 'running':
                setRunStatus('Running...');
                break;
            case 'completed':
                setRunStatus('Completed');
                break;
            case 'failed':
                setRunStatus('Failed!');
                break;
            default:
                setRunStatus('');
        }
    };


    const handleSave = async () => {
        setIsSaving(true);
        const logic = createLogicForSummary(content);
        await onUpdate({
            id: note.id,
            title,
            content,
            logic
        });
        setIsSaving(false);
        onRun(note.id);
    };

    const createLogicForSummary = (content) => {
        return [{id: crypto.randomUUID(), tool: 'summarize', input: {text: content}, status: 'pending'}];
    };

    return (
        <div style={{padding: '15px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '20px'}}>
            <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note Title"
                style={{width: '100%', padding: '8px', marginBottom: '10px'}}
            />
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your note here..."
                style={{width: '100%', height: '100px', padding: '8px', marginBottom: '10px'}}
            />
            <div style={{marginBottom: '10px'}}>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={saveButtonStyle(isSaving)}
                >
                    {isSaving ? 'Saving...' : 'Save and Summarize'}
                </button>
                <button
                    onClick={() => onRun(note.id)}
                    style={runButtonStyle}
                >
                    Re-run
                </button>
                {runStatus && <span style={{marginLeft: '10px'}}>{runStatus}</span>}
            </div>
            {note.memory.length > 0 && (
                <div style={resultStyle}>
                    <h4 style={resultTitleStyle}>Result:</h4>
                    <p>{note.memory[note.memory.length - 1].content}</p>
                </div>
            )}
        </div>
    );
}

const saveButtonStyle = (isSaving) => ({
    padding: '5px 10px',
    marginRight: '10px',
    background: isSaving ? '#cccccc' : '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: isSaving ? 'not-allowed' : 'pointer'
});

const runButtonStyle = {
    padding: '5px 10px',
    background: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px'
};

const resultStyle = {
    background: '#f9f9f9',
    padding: '10px',
    borderRadius: '4px'
};

const resultTitleStyle = {
    margin: '0 0 10px 0',
    fontSize: '16px'
};
