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
            className={isDragging && draggingIndex === index ? 'logic-step-item dragging' : 'logic-step-item'}
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
            <div style={{flexGrow: 1}}>
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
            <button onClick={() => onDeleteStep(index)} style={{marginLeft: '10px'}}>Delete</button>
        </li>
    );
}
