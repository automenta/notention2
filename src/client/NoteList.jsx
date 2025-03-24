import React from 'react';

const NOTE_STYLE = (note) => ({
    margin: '10px 0',
    padding: '10px',
    border: '1px solid #eee',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: note.id.startsWith('dev-') || note.id === 'seed-0' ? '#f0f0f0' : 'white', // Different background color
});

const DELETE_BUTTON_STYLE = {
    padding: '5px 10px',
    background: '#ff4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px'
};

const STATUS_INDICATOR_STYLE = (status) => {
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

export default function NoteList({notes, onSelect, onDelete}) {

    const sortedNotes = [...notes].sort((a, b) => b.priority - a.priority);

    return (
        <ul style={{listStyle: 'none', padding: 0}}>
            {sortedNotes.map(note => (
                <li
                    key={note.id}
                    style={NOTE_STYLE(note)}
                >
                    <span
                        onClick={() => onSelect(note.id)}
                        style={{cursor: 'pointer', flex: 1}}
                    >
                        {note.title}
                        <span style={STATUS_INDICATOR_STYLE(note.status)}>
                            {note.status}
                        </span>
                        {(note.memory ?? []).length > 0 && (
                            <span style={{color: '#555', marginLeft: '10px'}}>
                                - {note.memory[note.memory.length - 1].content.slice(0, 50)}...
                            </span>
                        )}
                    </span>
                    <button
                        onClick={() => onDelete(note.id)}
                        style={DELETE_BUTTON_STYLE}
                    >
                        Delete
                    </button>
                </li>
            ))}
        </ul>
    );
}
