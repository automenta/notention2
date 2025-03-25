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
    const [tempEdge, setTempEdge] = useState(null); // State for temporary edge
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
            initializeCytoscape(notes, cyRef.current, selectedNoteId, setSelectedNoteId, handleCreateNoteFromGraph, handleDeleteNodeFromGraph, handleCreateEdge);
        }
    }, [notes, selectedNoteId]);


    const initializeCytoscape = (notes, container, selectedNoteId, setSelectedNoteId, handleCreateNoteFromGraph, handleDeleteNodeFromGraph, handleCreateEdge) => {
        const cy = cytoscape({
            container: container,
            elements: [], // Initialize empty and add elements dynamically
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': (ele) => `${ele.data('label')}`,
                        'background-color': (ele) => {
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
                        'shape': (ele) => {
                            const status = ele.data('status');
                            if (ele.data('isStep')) return 'round-rectangle';
                            switch (status) {
                                case 'running':
                                    return 'diamond';
                                default:
                                    return 'ellipse';
                            }
                        },
                        'width': ele => ele.data('isStep') ? 60 : 80,
                        'height': ele => ele.data('isStep') ? 40 : 80,
                        'font-size': ele => ele.data('isStep') ? '0.8em' : '1em',
                        'text-valign': 'center',
                        'text-halign': 'center',
                    },
                },
                {selector: 'edge', style: {'width': 2, 'line-color': '#ccc'}},
                {
                    selector: '.temp-edge',
                    style: {
                        'line-color': 'blue',
                        'line-style': 'dashed',
                        'width': 2
                    }
                },
                {
                    selector: '.dragging-node',
                    style: {
                        'border-style': 'dashed',
                        'border-width': '3px',
                        'border-color': 'blue'
                    }
                },
                {
                    selector: '.selected-node',
                    style: {
                        'border-style': 'dashed',
                        'border-width': '4px',
                        'border-color': 'red'
                    }
                },
                {
                    selector: 'node[status = "running"]',
                    style: {
                        'transition-property': 'background-color',
                        'transition-duration': '0.7s',
                        'transition-timing-function': 'ease-in-out',
                        'animation-play-state': 'running',
                        'animation-direction': 'alternate',
                        'animation-iteration-count': 'infinite',
                        'animation-name': 'pulse-bg'
                    }
                },
                {
                    selector: 'node[status = "running"]',
                    css: {
                        'animation-play-state': 'running',
                    }
                },
                {
                    stylesheet: [
                        {
                            selector: 'node[status = "running"]',
                            css: {
                                'animation-play-state': 'running',
                            }
                        },
                        {
                            selector: 'node',
                            css: {
                                'animation-play-state': 'paused',
                            }
                        }
                    ]
                }


            ],
            layout: {name: 'grid'}
        });

        // Define the pulsing animation
        cy.style().selector('node[status = "running"]')
            .css({
                'animation-play-state': 'running',
                'animation-name': 'pulse-bg',
                'animation-duration': '1s',
                'animation-timing-function': 'ease-in-out',
                'animation-direction': 'alternate',
                'animation-iteration-count': 'infinite'
            })
            .update();

        cy.style().stylesheet()
            .append(`
                @keyframes pulse-bg {
                    0% { background-color: blue; }
                    100% { background-color: #87CEFA; } /* Light Sky Blue */
                }
            `).update();

        const mainNodes = notes.map(note => ({
            group: 'nodes',
            data: {
                id: note.id,
                label: note.title,
                status: note.status,
                noteData: note // Store entire note data
            }
        }));

        const edges = notes.flatMap(note => (note.references ?? []).map(ref => ({
            group: 'edges',
            data: {
                source: note.id,
                target: ref
            }
        })));

        cy.add(mainNodes.concat(edges));

        cy.on('click', 'node', function (evt) {
            const node = evt.target;
            setSelectedNoteId(node.id());
        });

        cy.on('cxttap', 'node', function (evt) {
            const node = evt.target;
            if (!node.data('isStep')) { // Prevent deleting step nodes directly
                handleDeleteNodeFromGraph(node.id());
            }
        });


        cy.on('dblclick', (event) => {
            if (event.target === cy) {
                handleCreateNoteFromGraph(event.position);
            }
        });

        cy.on('dragstart', 'node', function (evt) {
            if (edgeDrawingMode) {
                setSourceNode(evt.target);
            } else {
                evt.target.addClass('dragging-node');
            }
        });

        cy.on('drag', 'node', function (evt) {
            if (edgeDrawingMode && sourceNode) {
                const targetPos = evt.position;
                if (!tempEdge) {
                    const tempEdge = cy.add({
                        group: 'edges',
                        data: {id: 'temp-edge', source: sourceNode.id(), target: 'temp-target'},
                        classes: 'temp-edge'
                    });
                    setTempEdge(tempEdge);
                }
                tempEdge.targetEndpoint({x: targetPos.x, y: targetPos.y});
            }
        });

        cy.on('dragstop', 'node', function (evt) {
            if (edgeDrawingMode && sourceNode) {
                const targetNode = evt.target;
                if (sourceNode !== targetNode) {
                    handleCreateEdge(sourceNode.id(), targetNode.id());
                }
                setSourceNode(null);
                if (tempEdge) {
                    cy.remove(tempEdge);
                    setTempEdge(null);
                }
            } else {
                evt.target.removeClass('dragging-node');
            }
        });

        cy.on('mouseout', function (event) {
            if (edgeDrawingMode && sourceNode && tempEdge) {
                cy.remove(tempEdge);
                setTempEdge(null);
                setSourceNode(null);
            }
        });

        return cy;
    };

    const updateGraphSelection = (cy, notes, selectedNoteId) => {
        if (!cy) return;
        const mainNodes = notes.map(note => ({
            group: 'nodes',
            data: {
                id: note.id,
                label: note.title,
                status: note.status,
                noteData: note // Store entire note data
            }
        }));

        const edges = notes.flatMap(note => (note.references ?? []).map(ref => ({
            group: 'edges',
            data: {
                source: note.id,
                target: ref
            }
        })));

        cy.elements().remove(); // Clear existing elements

        // Add main notes and edges
        cy.add(mainNodes.concat(edges));

        cy.nodes().removeClass('selected-node'); // Clear previous selection

        if (selectedNoteId) {
            const selectedNote = notes.find(note => note.id === selectedNoteId);
            cy.getElementById(selectedNoteId).addClass('selected-node'); // Add class to selected node
            if (selectedNote && selectedNote.logic) {
                const stepNodes = selectedNote.logic.map((step, index) => ({
                    group: 'nodes',
                    data: {
                        id: step.id,
                        label: `Step ${index + 1}: ${step.tool}`,
                        status: step.status,
                        isStep: true,
                        parent: selectedNoteId // Make step nodes children of selected note
                    }
                }));
                const stepEdges = selectedNote.logic.map((step, index) => {
                    if (index > 0) {
                        return {
                            group: 'edges',
                            data: {
                                source: selectedNote.logic[index - 1].id,
                                target: step.id
                            }
                        };
                    }
                    return null;
                }).filter(edge => edge); // Filter out nulls

                cy.add(stepNodes);
                cy.add(stepEdges);


                // Apply layout for step nodes - force directed layout for steps within the selected node
                cy.layout({
                    name: 'cose',
                    animate: false,
                    //boundingBox: cy.getElementById(selectedNoteId).boundingBox(), // Layout only steps
                    padding: 10,
                    parent: cy.getElementById(selectedNoteId) // Apply layout to children of selected node
                }).run();


                cy.fit(); // Fit graph to content after adding steps
            }
        } else {
            cy.layout({name: 'grid'}).run(); // Default layout when no note selected
            cy.fit(); // Fit graph to content
        }
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
            <div style={{
                padding: '10px',
                backgroundColor: connectionStatus === 'Connected' ? '#e0f7fa' : connectionStatus === 'Error' ? '#ffebee' : '#fffde7',
                borderRadius: '5px',
                marginBottom: '10px',
                border: '1px solid',
                borderColor: connectionStatus === 'Connected' ? '#b2ebf2' : connectionStatus === 'Error' ? '#ffcdd2' : '#ffecb3'
            }}>
                <strong>Connection Status: {connectionStatus}</strong>
                {connectionStatus !== 'Connected' && connectionStatus !== 'Connecting...' && (
                    <p style={{fontSize: '0.9em', color: 'grey'}}>
                        Please check if the server is running and refresh the page.
                    </p>
                )}
            </div>

            <div>
                <button
                    onClick={handleCreateNote}
                    disabled={connectionStatus !== 'Connected'}
                    title="Create a new note"
                >
                    + Note
                </button>
                <button
                    onClick={() => setEdgeDrawingMode(!edgeDrawingMode)}
                    disabled={connectionStatus !== 'Connected'}
                    title={edgeDrawingMode ? 'Disable edge drawing mode' : 'Enable edge drawing mode'}
                >
                    {edgeDrawingMode ? 'Disable Edge Draw' : 'Enable Edge Draw'}
                </button>
            </div>
            <NoteList
                notes={connectionStatus === 'Connected' ? notes : []}
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
