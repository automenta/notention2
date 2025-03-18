import React from 'react';

export default function NoteList({ notes, onSelect, onDelete }) {
    return (
        <ul style={{ listStyle: 'none', padding: 0 }}>
            {notes.map(note => (
                <li key={note.id} style={{ margin: '5px 0', display: 'flex', alignItems: 'center' }}>
                    <span
                        onClick={() => onSelect(note.id)}
                        style={{ cursor: 'pointer', flex: 1 }}
                    >
                        {note.title} <span style={{ color: note.status === 'completed' ? 'green' : 'gray' }}>
                            ({note.status})
                        </span>
                    </span>
                    <button onClick={() => onDelete(note.id)} style={{ marginLeft: '5px' }}>Delete</button>
                </li>
            ))}
        </ul>
    );
}
