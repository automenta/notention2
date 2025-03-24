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
                        <span style={{
                            marginLeft: '8px',
                            fontSize: '0.8em',
                            fontWeight: 'bold',
                            color: note.status === 'pending' ? 'orange' :
                                   note.status === 'running' ? 'blue' :
                                   note.status === 'completed' ? 'green' :
                                   note.status === 'failed' ? 'red' :
                                   note.status === 'pendingUnitTesting' ? 'purple' :
                                   'grey' // default
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
