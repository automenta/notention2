import React, {useEffect, useState} from 'react';
import crypto from 'crypto';
import ReactMarkdown from 'react-markdown';

const SAVE_BUTTON_STYLE = (isSaving) => ({
    padding: '5px 10px',
    marginRight: '10px',
    background: isSaving ? '#cccccc' : '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: isSaving ? 'not-allowed' : 'pointer'
});

const RESULT_STYLE = {
    background: '#f9f9f9',
    padding: '10px',
    borderRadius: '4px'
};

const RESULT_TITLE_STYLE = {
    margin: '0 0 10px 0',
    fontSize: '16px'
};

const STATUS_STYLE = (status) => {
    let color = 'gray';
    switch (status) {
        case 'running':
            color = 'blue';
            break;
        case 'completed':
            color = 'green';
            break;
        case 'failed':
            color = 'red';
            break;
        default:
            color = 'gray';
    }
    return {
        marginLeft: '10px',
        color: color,
        fontWeight: 'bold'
    };
};

const createLogicForSummary = (content) => {
    return [{id: crypto.randomUUID(), tool: 'summarize', input: {text: content}, status: 'pending'}];
};


export default function NoteEditor({note, onUpdate}) {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content || '');
    const [priority, setPriority] = useState(note.priority || 50); // Default priority
    const [deadline, setDeadline] = useState(note.deadline || ''); // Default deadline
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setTitle(note.title);
        setContent(note.content || '');
        setPriority(note.priority || 50);
        setDeadline(note.deadline || '');
    }, [note]);

    const handleSave = async () => {
        setIsSaving(true);
        const logic = createLogicForSummary(content);
        await onUpdate({
            id: note.id,
            title,
            content,
            priority,
            deadline,
            logic
        });
        setIsSaving(false);
    };

    return (
        <div style={{padding: '15px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '20px'}}>
            <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note Title"
                style={{width: '100%', padding: '8px', marginBottom: '10px'}}
            />
            <label htmlFor="priority" style={{display: 'block', marginBottom: '5px'}}>Priority:</label>
            <input
                type="number"
                id="priority"
                value={priority}
                onChange={e => setPriority(parseInt(e.target.value))}
                style={{width: '100%', padding: '8px', marginBottom: '10px'}}
            />
            <label htmlFor="deadline" style={{display: 'block', marginBottom: '5px'}}>Deadline:</label>
            <input
                type="datetime-local"
                id="deadline"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
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
                    style={SAVE_BUTTON_STYLE(isSaving)}
                >
                    {isSaving ? 'Saving...' : 'Save and Run'}
                </button>
                <span style={STATUS_STYLE(note.status)}>{note.status}</span>
            </div>
            {note.memory?.length > 0 && (
                <div style={RESULT_STYLE}>
                    <h4 style={RESULT_TITLE_STYLE}>Result:</h4>
                    <ReactMarkdown>{note.memory[note.memory.length - 1].content}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}
