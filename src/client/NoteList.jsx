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
                            style={{
                                display: 'inline-block',
                                marginLeft: '8px',
                                width: '10px',
                                height: '10px',
                                borderRadius: '3px',
                                backgroundColor: note.status === 'pending' ? 'orange' :
                                    note.status === 'running' ? 'blue' :
                                        note.status === 'completed' ? 'green' :
                                            note.status === 'failed' ? 'red' :
                                                note.status === 'pendingUnitTesting' ? 'purple' :
                                                    'grey' // default
                            }}></span>
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
