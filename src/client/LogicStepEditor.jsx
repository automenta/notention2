import React, {useState} from 'react';
import LogicStepItem from './LogicStepItem.jsx'; // Import LogicStepItem
import {getToolSchema} from './tool_utils';
import ToolInputRenderer from './ToolInputRenderer.jsx';

export default function LogicStepEditor({logic, onChange, availableTools}) {
    const [draggingIndex, setDraggingIndex] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleAddStep = () => {
        const newStep = {
            id: `step-${Date.now()}`,
            tool: availableTools.length > 0 ? availableTools[0].name : '',
            input: {},
            dependencies: [],
            status: 'pending'
        };
        onChange([...logic, newStep]);
    };

    const handleStepChange = (index, field, value) => {
        const updatedLogic = logic.map((step, i) =>
            i === index ? {...step, [field]: value} : step
        );
        onChange(updatedLogic);
    };

    const handleDragStart = (event, index) => {
        setDraggingIndex(index);
        setIsDragging(true);
        event.dataTransfer.setData("text/plain", index);
        event.target.classList.add('dragging');
    };

    const handleDragOver = (event, index) => {
        event.preventDefault();
        if (isDragging && draggingIndex !== index && draggingIndex !== null) {
            const updatedLogic = [...logic];
            const draggedStep = updatedLogic[draggingIndex];
            updatedLogic.splice(draggingIndex, 1);
            updatedLogic.splice(index, 0, draggedStep);
            onChange(updatedLogic);
            setDraggingIndex(index);
        }
    };

    const handleDragEnd = (event) => {
        setIsDragging(false);
        setDraggingIndex(null);
        event.target.classList.remove('dragging');
    };

    const handleDeleteStep = (index) => {
        const updatedLogic = logic.filter((_, i) => i !== index);
        onChange(updatedLogic);
    };

    const getStepDepth = (stepId, logic) => {
        let depth = 0;
        let currentStep = logic.find(step => step.id === stepId);
        if (!currentStep || !currentStep.dependencies || currentStep.dependencies.length === 0) {
            return depth;
        }

        let maxDependencyDepth = 0;
        for (const depId of currentStep.dependencies) {
            maxDependencyDepth = Math.max(maxDependencyDepth, getStepDepth(depId, logic) + 1);
        }
        return maxDependencyDepth;
    };

    return (
        <div>
            <label style={{marginRight: '10px'}}>Logic Steps:</label>
            <ul style={{padding: 0}}>
                {logic.map((step, index) => (
                    <LogicStepItem
                        key={step.id}
                        step={step}
                        index={index}
                        availableTools={availableTools}
                        onStepChange={handleStepChange}
                        onDeleteStep={handleDeleteStep}
                        isDragging={isDragging}
                        draggingIndex={draggingIndex}
                        depth={getStepDepth(step.id, logic)}
                        renderInputFields={(step, index) => {
                            const schema = getToolSchema(availableTools, step.tool);
                            const handleInputChange = (paramName, paramValue) => {
                                const updatedInput = {...step.input, [paramName]: paramValue};
                                handleStepChange(index, 'input', updatedInput);
                            };

                            return (
                                <ToolInputRenderer
                                    key={index}
                                    schema={schema}
                                    input={step.input}
                                    onInputChange={handleInputChange}
                                />
                            );
                        }}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    />
                ))}
            </ul>
            <button onClick={handleAddStep}>Add Step</button>
            <style jsx>{`
                .logic-step-item.dragging {
                    opacity: 0.5;
                    border: 2px dashed #999;
                    background-color: #fafafa;
                }

                .logic-step-item:not(:last-child)::after {
                    content: '';
                    position: absolute;
                    left: 20px; /* Adjust as needed for indentation */
                    top: 100%;
                    width: 2px;
                    height: 20px; /* Adjust line length as needed */
                    background: dashed linear-gradient(to bottom, #ccc 50%, transparent 50%);
                    background-size: 100% 6px;
                    background-repeat: repeat-y;
                }

                .step-status-pending {
                    background-color: #fffde7; /* Light yellow for pending */
                }

                .step-status-running {
                    background-color: #e3f2fd; /* Light blue for running */
                }

                .step-status-completed {
                    background-color: #e8f5e9; /* Light green for completed */
                }

                .step-status-failed {
                    background-color: #ffebee; /* Light red for failed */
                }

                .step-status-completed {
                    background-color: #e8f5e9; /* Light green for completed */
                }

                .step-status-failed {
                    background-color: #ffebee; /* Light red for failed */
                }

                .logic-step-item .dependency-connector {
                    position: absolute;
                    left: 0px; /* Adjust as needed */
                    top: 0;
                    height: 100%;
                    border-left: 2px dashed #ccc;
                }

                .logic-step-item .step-connector-anchor::after {
                    content: '';
                    position: absolute;
                    left: 10px; /* Adjust to align with anchor */
                    top: 0%;
                    height: 100%;
                    width: 2px;
                    background: dashed linear-gradient(to bottom, #ccc 0%, #ccc 100%);
                    background-size: 100% 6px;
                    background-repeat: repeat-y;
                    z-index: -1;
                }

                .logic-step-item:not(:last-child):hover::after {
                    background: dashed linear-gradient(to bottom, #007bff 50%, transparent 50%); /* Highlight on hover */
                    background-size: 100% 6px;
                }

                .step-running {
                    border: 2px solid blue;
                    box-shadow: 0 0 5px blue;
                }

                .step-loading-indicator {
                    display: inline-block;
                    width: 15px;
                    height: 15px;
                    margin-left: 5px;
                    vertical-align: middle;
                }

                .spinner {
                    border: 2px solid rgba(0, 0, 0, 0.1);
                    border-left-color: #007bff;
                    border-radius: 50%;
                    width: 12px;
                    height: 12px;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% {
                        transform: rotate(0deg);
                    }

                    100% {
                        transform: rotate(360deg);
                    }
                }


                ul {
                    position: relative; /* Needed for absolute positioning of pseudo-element */
                    padding-left: 20px; /* Adjust to align with the connector line */
                }

                li {
                    position: relative; /* To position the pseudo-element connector */
                }


            `}</style>
        </div>
    );
}
