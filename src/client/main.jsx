import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import NoteList from './NoteList.jsx';
import NoteEditor from './NoteEditor.jsx';
import cytoscape from 'cytoscape';

function App() {
    const [notes, setNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState(null);
    const [ws, setWs] = useState(null);

    useEffect(() => {
        let websocket;
        const connect = () => {
            websocket = new WebSocket('ws://localhost:8080');
            websocket.onopen = () => console.log('WebSocket connected');
            websocket.onmessage = (ev) => {
                const {type, data} = JSON.parse(ev.data);
                if (type === 'notes') setNotes(data);
                if (type === 'noteUpdate') setNotes((prev) =>
                    prev.map(n => n.id === data.id ? data : n).filter(n => n));
            };
            websocket.onerror = () => console.error('WebSocket error');
            websocket.onclose = () => setTimeout(connect, 1000); // Reconnect after 1s
            setWs(websocket);
        };
        connect();
        return () => websocket?.close();
    }, []);

    useEffect(() => {
        const cy = cytoscape({
            container: document.getElementById('cy'),
            elements: notes.map(note => ({ data: { id: note.id, label: note.title } }))
                .concat(notes.flatMap(note => note.references.map(ref => ({ data: { source: note.id, target: ref } })))),
            style: [
                { selector: 'node', style: { 'label': 'data(label)', 'background-color': '#666', 'color': '#fff' } },
                { selector: 'edge', style: { 'width': 2, 'line-color': '#ccc', 'curve-style': 'bezier' } }
            ],
            layout: { name: 'grid' }
        });
    }, [notes]);


    const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

    return (
        <div>
            <h1>Netention</h1>
            {ws?.readyState !== 1 && <p style={{color: 'red'}}>WebSocket disconnected</p>}
            <button onClick={() => send({type: 'createNote', title: 'New Note'})}>Add Note</button>
            <NoteList
                notes={notes}
                onSelect={setSelectedNoteId}
                onDelete={(id) => send({type: 'deleteNote', id})}
            />
            {selectedNoteId && (
                <NoteEditor
                    note={notes.find(n => n.id === selectedNoteId)}
                    onUpdate={(updates) => send({type: 'updateNote', ...updates})}
                    onRun={(id) => send({type: 'runNote', id})}
                />
            )}
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App/>);
