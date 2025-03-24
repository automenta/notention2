import React from 'react';
import ReactJson from 'react-json-view';

export default function LogicStepItem({ step, index, availableTools, onStepChange, onDeleteStep, isDragging, draggingIndex, renderInputFields }) {

    return (
        <li
            key={step.id}
            draggable="true"
            onDragStart={(e) => step.onDragStart(e, index)}
            onDragOver={(e) => step.onDragOver(e, index)}
            onDragEnd={step.onDragEnd}
            style={{
                border: '1px solid #ccc',
                padding: '10px',
                marginBottom: '5px',
                borderRadius: '4px',
                backgroundColor: isDragging && draggingIndex === index ? '#f0f0f0' : 'white',
                cursor: 'grab',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}
        >
            <div style={{ flexGrow: 1 }}>
                <div><strong>Step {index + 1}:</strong></div>
                <div>
                    <label style={{ marginRight: '10px' }}>Tool:</label>
                    <select
                        value={step.tool}
                        onChange={e => onStepChange(index, 'tool', e.target.value)}
                    >
                        {availableTools.map(tool => (
                            <option key={tool.name} value={tool.name}>{tool.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    {renderInputFields(step, index)}
                </div>
                <div>Status: {step.status}</div>
            </div>
            <button onClick={() => onDeleteStep(index)} style={{ marginLeft: '10px' }}>Delete</button>
        </li>
    );
}
