import React from 'react';

export default function NoteList({notes, onSelect, onDelete}) {
    return (
        <ul style={{listStyle: 'none', padding: 0}}>
            {notes.map(note => (
                <li key={note.id} style={{margin: '5px 0', display: 'flex', alignItems: 'center'}}>
                    <span
                        onClick={() => onSelect(note.id)}
                        style={{cursor: 'pointer', flex: 1}}
                    >
                        {note.title} ({note.status}) {note.references.length > 0 && `(${note.references.length} refs)`}
                    </span>
                    <button onClick={() => onDelete(note.id)} style={{marginLeft: '5px'}}>Delete</button>
                </li>
            ))}
        </ul>
    );
}
