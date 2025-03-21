import React from 'react';

export default function NoteList({notes, onSelect, onDelete}) {
    const isDevNote = (note) => note.id.startsWith('dev-') || note.id === 'seed-0';

    return (
        <ul style={{listStyle: 'none', padding: 0}}>
            {notes.map(note => (
                <li
                    key={note.id}
                    style={{
                        margin: '10px 0',
                        padding: '10px',
                        border: '1px solid #eee',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: isDevNote(note) ? '#f0f0f0' : 'white', // Different background color
                    }}
                >
                    <span
                        onClick={() => onSelect(note.id)}
                        style={{cursor: 'pointer', flex: 1}}
                    >
                        {note.title} <small>({note.status})</small>
                        {(note.memory ?? []).length > 0 && (
                            <span style={{color: '#555', marginLeft: '10px'}}>
                                - {note.memory[note.memory.length - 1].content.slice(0, 50)}...
                            </span>
                        )}
                    </span>
                    <button
                        onClick={() => onDelete(note.id)}
                        style={{
                            padding: '5px 10px',
                            background: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px'
                        }}
                    >
                        Delete
                    </button>
                    {note.status === 'running' && (
                        <span style={{color: 'blue', marginLeft: '10px'}}>Running...</span>
                    )}
                    {note.status === 'failed' && (
                        <span style={{color: 'red', marginLeft: '10px'}}>Failed!</span>
                    )}
                    {note.status === 'pendingUnitTesting' && (
                        <span style={{color: 'orange', marginLeft: '10px'}}>Pending Unit Test</span>
                    )}
                </li>
            ))}
        </ul>
    );
}
