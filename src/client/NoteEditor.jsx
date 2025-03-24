import React, {useEffect, useState} from 'react';

export default function NoteEditor({note, onUpdate}) {
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');

    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setContent(note.content || '');
        }
    }, [note]);

    const handleSave = () => {
        onUpdate({
            id: note.id,
            title,
            content
        });
    };

    return (
        <div>
            <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note Title"
            />
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your note here..."
            />
            <button onClick={handleSave}>Save</button>
        </div>
    );
