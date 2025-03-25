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
            style={{paddingLeft: `${indentation}px`}}
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
            <div style={{flexGrow: 1, position: 'relative'}}>
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
                <div>
                    Status: {step.status}
                    {step.status === 'running' && (
                        <div className="step-loading-indicator">
                            <div className="spinner"></div>
                        </div>
                    )}
                </div>
            </div>
            <div className="step-connector-anchor" style={{
                position: 'absolute',
                right: '-10px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                zIndex: 10,
                pointerEvents: 'none'
            }}></div>
            <button onClick={() => onDeleteStep(index)} style={{marginLeft: '10px'}}>Delete</button>
        </li>
    );
}
