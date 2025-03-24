import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import NoteList from './NoteList.jsx';
import NoteEditor from './NoteEditor.jsx';
import cytoscape from 'cytoscape';

const CONNECTING_STYLE = {
    color: 'orange',
    marginBottom: '10px'
};

const CONNECTED_STYLE = {
    color: 'green',
    marginBottom: '10px'
};

const DISCONNECTED_STYLE = {
    color: 'red',
    marginBottom: '10px'
};

function App() {
    const [notes, setNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState(null);
    const [ws, setWs] = useState(null);
    const cyRef = useRef(null); // Ref for Cytoscape container
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
                setWs(new WebSocket('ws://localhost:8080')); // Reconnect on close
                setConnectionStatus('Connecting...');
            }, 1000);
        };

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

    const handleCreateNote = () => {
        send({type: 'createNote', title: 'New Note'});
    };

    let connectionStyle;
    switch (connectionStatus) {
        case 'Connected':
            connectionStyle = CONNECTED_STYLE;
            break;
        case 'Error':
        case 'Disconnected':
            connectionStyle = DISCONNECTED_STYLE;
            break;
        default:
            connectionStyle = CONNECTING_STYLE;
    }


    return (
        <div style={{padding: '20px', maxWidth: '800px', margin: '0 auto'}}>
            <h1 style={{fontSize: '24px', marginBottom: '20px'}}>Netention</h1>
            <p style={connectionStyle}>{connectionStatus}</p>

            <div style={{marginBottom: '20px'}}>
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
            <div id="cy" style={{width: '100%', height: '300px', marginTop: '20px', border: '1px solid #ddd'}}
                 ref={cyRef}></div>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App/>);
