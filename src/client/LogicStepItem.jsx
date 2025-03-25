import React from 'react';
import StepToolSelect from './StepToolSelect.jsx'; // Import StepToolSelect
import StepInput from './StepInput.jsx'; // Import StepInput

export default function LogicStepItem({
                                          step,
                                          index,
                                          availableTools,
                                          onStepChange,
                                          onDeleteStep,
                                          isDragging,
                                          draggingIndex,
                                           depth
                                       }) {

    const indentation = depth * 20; // Adjust the indentation level as needed

    return (
        <li
            key={step.id}
            style={{ paddingLeft: `${indentation}px` }}
            draggable="true"
            onDragStart={(e) => step.onDragStart(e, index)}
            onDragOver={(e) => step.onDragOver(e, index)}
            onDragEnd={step.onDragEnd}
            className={`logic-step-item ${isDragging && draggingIndex === index ? 'dragging' : ''} step-status-${step.status} ${step.status === 'running' ? 'step-running' : ''}`}
            title={availableTools.find(tool => tool.name === step.tool)?.description || step.tool}
            style={{
                border: '1px solid #ccc',
                padding: '10px',
                marginBottom: '5px',
                borderRadius: '4px',
                backgroundColor: isDragging && draggingIndex === index ? '#f0f0f0' : 'white',
                cursor: 'grab',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative'
            }}
        >
            <div style={{flexGrow: 1, position: 'relative'}}> {/* Make inner div relative for absolute positioning of connector */}
                <div><strong>Step {index + 1}:</strong></div>
                <StepToolSelect
                    step={step}
                    availableTools={availableTools}
                    onStepChange={onStepChange}
                    index={index}
                />
                <StepInput
                    step={step}
                    availableTools={availableTools}
                    onStepChange={onStepChange}
                    index={index}
                />
                <div>Status: {step.status}</div>
            </div>
            <div className="step-connector-anchor" style={{
                position: 'absolute',
                right: '-10px', // Adjust as needed
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px', // Width for visibility and click area if needed
                height: '20px', // Height for visibility and click area if needed
                // backgroundColor: 'red', // For debugging, remove later
                zIndex: 10, // Ensure it's above other elements
                pointerEvents: 'none' // Make it non-interactive
            }}></div>
            <button onClick={() => onDeleteStep(index)} style={{marginLeft: '10px'}}>Delete</button>
        </li>
    );
}
