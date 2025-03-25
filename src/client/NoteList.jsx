import React from 'react';

export default function NoteList({notes, onSelect, onDelete}) {
    return (
        <ul>
            {notes.map(note => (
                <li key={note.id}>
                    <span onClick={() => onSelect(note.id)} style={{cursor: 'pointer'}}>
                        {note.title}
                        <span style={{
                            marginLeft: '8px',
                            fontSize: '0.8em',
                            color: 'grey'
                        }}>
                            (Priority: {note.priority})
                        </span>
                        <span
                            title={note.status} // Add tooltip here
                            className={`note-status ${note.status}`}
                        ></span>
                        <span style={{
                            marginLeft: '4px',
                            fontSize: '0.8em',
                            color: 'grey'
                        }}>
                            ({note.status})
                        </span>
                    </span>
                    <button onClick={() => onDelete(note.id)}>Delete</button>
                </li>
            ))}
        </ul>
    );
}
