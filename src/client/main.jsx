import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import NoteList from './NoteList.jsx';
import NoteEditor from './NoteEditor.jsx';
import cytoscape from 'cytoscape';

function App() {
    const [notes, setNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState(null);
    const [ws, setWs] = useState(null);
    const cyRef = useRef(null); // Ref for Cytoscape container

    useEffect(() => {
        const websocket = new WebSocket('ws://localhost:8080');
        websocket.onopen = () => console.log('WebSocket connected');
        websocket.onmessage = (ev) => {
            const {type, data} = JSON.parse(ev.data);
            if (type === 'notes') setNotes(data);
            if (type === 'noteUpdate') setNotes((prev) =>
                prev.map(n => n.id === data.id ? data : n).filter(n => n));
        };
        websocket.onerror = () => console.error('WebSocket error');
        websocket.onclose = () => setTimeout(() => {
            setWs(new WebSocket('ws://localhost:8080')); // Reconnect on close
        }, 1000);
        setWs(websocket);
        return () => websocket.close();
    }, []);

    useEffect(() => {
        if (notes.length > 0 && cyRef.current) {
            initializeCytoscape(notes, cyRef.current);
        }
    }, [notes]);


    const initializeCytoscape = (notes, container) => {
        cytoscape({
            container: container,
            elements: notes.map(note => ({data: {id: note.id, label: note.title}}))
                .concat(notes.flatMap(note => (note.references ?? []).map(ref => ({
                    data: {
                        source: note.id,
                        target: ref
                    }
                })))),
            style: [
                {selector: 'node', style: {'label': 'data(label)', 'background-color': '#666', 'color': '#fff'}},
                {selector: 'edge', style: {'width': 2, 'line-color': '#ccc', 'curve-style': 'bezier'}}
            ],
            layout: {name: 'grid'}
        });
    };


    const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

    return (
        <div style={{padding: '20px', maxWidth: '800px', margin: '0 auto'}}>
            <h1 style={{fontSize: '24px', marginBottom: '20px'}}>Netention</h1>
            {ws?.readyState !== 1 && <p style={{color: 'red', marginBottom: '10px'}}>Connecting...</p>}
            <div style={{marginBottom: '20px'}}>
                <input
                    type="text"
                    placeholder="New Note Title"
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.target.value) {
                            send({type: 'createNote', title: e.target.value});
                            e.target.value = '';
                        }
                    }}
                    style={{padding: '8px', width: '70%', marginRight: '10px'}}
                />
                <button onClick={() => send({type: 'createNote', title: 'New Note'})}>Add</button>
            </div>
            <NoteList
                notes={notes}
                onSelect={setSelectedNoteId}
                onDelete={(id) => send({type: 'deleteNote', id})}
            />
            {selectedNoteId && (
                <NoteEditor
                    note={notes.find(n => n.id === selectedNoteId)}
                    onUpdate={(updates) => send({type: 'updateNote', ...updates})}
                    // onUpdate={(updates) => console.log("Update Note:", updates)} // Debugging
                    onRun={(id) => send({type: 'runNote', id})}
                />
            )}
            <div id="cy" style={{width: '100%', height: '300px', marginTop: '20px', border: '1px solid #ddd'}}
                 ref={cyRef}></div>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App/>);
