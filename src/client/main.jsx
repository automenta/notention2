import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import NoteList from './NoteList.jsx';
import NoteEditor from './NoteEditor.jsx';
import cytoscape from 'cytoscape';
import popper from 'cytoscape-popper';

cytoscape.use(popper);

function App() {
    const [notes, setNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState(null);
    const [ws, setWs] = useState(null);
    const cyRef = useRef(null);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [edgeDrawingMode, setEdgeDrawingMode] = useState(false);
    const [sourceNode, setSourceNode] = useState(null);
    const [availableTools, setAvailableTools] = useState([]); // State to hold available tools


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
            if (type === 'tools') setAvailableTools(data);
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
            initializeCytoscape(notes, cyRef.current, setSelectedNoteId, handleCreateNoteFromGraph, handleDeleteNodeFromGraph, handleCreateEdge); // Pass handleCreateEdge
        }
    }, [notes]);


    const initializeCytoscape = (notes, container, setSelectedNoteId, handleCreateNoteFromGraph, handleDeleteNodeFromGraph, handleCreateEdge) => { // Accept handleCreateEdge
        const cy = cytoscape({
            container: container,
            elements: notes.map(note => ({
                data: {
                    id: note.id,
                    label: note.title,
                    status: note.status
                }
            })) // Include status in node data
                .concat(notes.flatMap(note => (note.references ?? []).map(ref => ({
                    data: {
                        source: note.id,
                        target: ref
                    }
                })))),
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'background-color': (ele) => { // Color based on status
                            const status = ele.data('status');
                            switch (status) {
                                case 'pending':
                                    return 'orange';
                                case 'running':
                                    return 'blue';
                                case 'completed':
                                    return 'green';
                                case 'failed':
                                    return 'red';
                                case 'pendingUnitTesting':
                                    return 'purple';
                                default:
                                    return '#666';
                            }
                        },
                        'width': 80,
                        'height': 80
                    }
                },
                {selector: 'edge', style: {'width': 2, 'line-color': '#ccc'}}
            ],
            layout: {name: 'grid'}
        });

        cy.on('click', 'node', function (evt) { // Handle node click
            var node = evt.target;
            setSelectedNoteId(node.id()); // Update selectedNoteId in App
        });

        cy.on('cxttap', 'node', function (evt) { // Handle context tap (right click) on node
            var node = evt.target;
            handleDeleteNodeFromGraph(node.id()); // Call delete node handler
        });


        cy.on('dblclick', (event) => { // Handle graph double click
            if (event.target === cy) { // Check if clicked on background
                handleCreateNoteFromGraph(event.position); // Call create note handler, pass position
            }
        });

        cy.on('dragstart', 'node', function (evt) {
            if (edgeDrawingMode) {
                setSourceNode(evt.target);
            }
        });

        cy.on('drag', 'node', function (evt) {
            if (edgeDrawingMode && sourceNode) {
                // visual feedback during drag if needed
            }
        });

        cy.on('dragstop', 'node', function (evt) {
            if (edgeDrawingMode && sourceNode) {
                const targetNode = evt.target;
                if (sourceNode !== targetNode) {
                    handleCreateEdge(sourceNode.id(), targetNode.id());
                }
                setSourceNode(null);
            }
        });
    };


    const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

    const handleCreateNote = () => {
        send({type: 'createNote', title: 'New Note'});
    };

    // New handler for creating note from graph click
    const handleCreateNoteFromGraph = (position) => {
        send({type: 'createNote', title: 'New Note from Graph', position: position}); // Send position data
    };

    // New handler to delete node from graph
    const handleDeleteNodeFromGraph = (nodeId) => {
        send({type: 'deleteNote', id: nodeId});
    };

    // New handler to create edge between nodes
    const handleCreateEdge = (sourceNoteId, targetNoteId) => {
        send({type: 'createEdge', sourceId: sourceNoteId, targetId: targetNoteId});
    };


    return (
        <div>
            <h1>Netention</h1>
            <p>{connectionStatus}</p>

            <div>
                <button onClick={handleCreateNote}>+ Note</button>
                <button onClick={() => setEdgeDrawingMode(!edgeDrawingMode)}>
                    {edgeDrawingMode ? 'Disable Edge Draw' : 'Enable Edge Draw'}
                </button>
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
                    availableTools={availableTools} // Pass availableTools as prop
                />
            )}
            <div id="cy" style={{width: '100%', height: '300px', border: '1px solid #ddd'}}
                 ref={cyRef}></div>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App/>);
