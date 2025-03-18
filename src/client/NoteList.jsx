import React from 'react';

export default function NoteList({notes, onSelect, onDelete}) {
    return (
        <ul>
            {notes.map(note => (
                <li key={note.id}>
                <span onClick={() => onSelect(note.id)}>
                {note.title} ({note.status})
                </span>
                    <button onClick={() => onDelete(note.id)}>Delete</button>
                </li>
            ))}
        </ul>
    );
}