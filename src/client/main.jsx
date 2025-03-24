import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import NoteList from './NoteList.jsx';
import NoteEditor from './NoteEditor.jsx';
import cytoscape from 'cytoscape';

function App() {
    const [notes, setNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState(null);
    const [ws, setWs] = useState(null);
    const cyRef = useRef(null);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');

    useEffect(() => {
        const websocket = new WebSocket('ws://localhost:8080');

        websocket.onopen = () => {
            console.log('WebSocket connected');
            setConnectionStatus('Connected');
        };

        websocket.onmessage = (ev) => {
            const {type, data} = JSON.parse(ev.data);
            if (type === 'notes') setNotes(data);
            if (type === 'noteUpdate') setNotes((prev) =>
                prev.map(n => n.id === data.id ? data : n).filter(n => n));
        };

        websocket.onerror = () => {
            console.error('WebSocket error');
            setConnectionStatus('Error');
        };

        websocket.onclose = () => {
            console.log('WebSocket disconnected');
            setConnectionStatus('Disconnected');
            setTimeout(() => {
                setWs(new WebSocket('ws://localhost:8080'));
                setConnectionStatus('Connecting...');
            }, 1000);
        };

        setWs(websocket);
        return () => websocket.close();
    }, []);

    useEffect(() => {
        if (notes.length > 0 && cyRef.current) {
            initializeCytoscape(notes, cyRef.current, setSelectedNoteId); // Pass setSelectedNoteId
        }
    }, [notes]);


    const initializeCytoscape = (notes, container, setSelectedNoteId) => { // Accept setSelectedNoteId
        const cy = cytoscape({
            container: container,
            elements: notes.map(note => ({data: {id: note.id, label: note.title}}))
                .concat(notes.flatMap(note => (note.references ?? []).map(ref => ({
                    data: {
                        source: note.id,
                        target: ref
                    }
                })))),
            style: [
                {selector: 'node', style: {'label': 'data(label)'}},
                {selector: 'edge', style: {'width': 2, 'line-color': '#ccc'}}
            ],
            layout: {name: 'grid'}
        });

        cy.on('click', 'node', function(evt){ // Handle node click
            var node = evt.target;
            setSelectedNoteId(node.id()); // Update selectedNoteId in App
        });
    };


    const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

    const handleCreateNote = () => {
        send({type: 'createNote', title: 'New Note'});
    };


    return (
        <div>
            <h1>Netention</h1>
            <p>{connectionStatus}</p>

            <div>
                <button onClick={handleCreateNote}>+</button>
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
                />
            )}
            <div id="cy" style={{width: '100%', height: '300px', border: '1px solid #ddd'}}
                 ref={cyRef}></div>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App/>);
