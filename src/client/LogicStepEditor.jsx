import React, {useState} from 'react';
import ReactJson from 'react-json-view';
import LogicStepItem from './LogicStepItem.jsx'; // Import LogicStepItem

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

    const getToolSchema = (toolName) => {
        const tool = availableTools.find(t => t.name === toolName);
        return tool?.schema;
    };

    const renderInputFields = (step, index) => {
        const schema = getToolSchema(step.tool);
        if (!schema || !schema.properties) {
            return <div>No schema available for this tool.</div>;
        }

        return Object.entries(schema.properties).map(([paramName, paramSchema]) => {
            const value = step.input[paramName] !== undefined ? step.input[paramName] : '';

            const handleInputChange = (paramValue) => {
                const updatedInput = {...step.input, [paramName]: paramValue};
                handleStepChange(index, 'input', updatedInput);
            };


            return (
                <div key={paramName} style={{marginBottom: '10px'}}>
                    <label style={{marginRight: '10px'}}>{paramName}:</label>
                    <ReactJson
                        src={value || null} // Use null for empty values
                        onEdit={(val) => handleInputChange(val.updated_src)}
                        onAdd={(val) => handleInputChange(val.updated_src)}
                        onDelete={(val) => handleInputChange(val.updated_src)}
                        displayObjectSize={false}
                        displayDataTypes={false}
                    />
                </div>
            );

        });
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
                        renderInputFields={renderInputFields}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        depth={getStepDepth(step.id, logic)} // Calculate depth
                    />
                ))}
            </ul>
            <button onClick={handleAddStep}>Add Step</button>
            {/* Utility function to calculate step depth */}
            {/* Consider moving this function outside the component if used elsewhere */}
            {/* or making it a separate utility module */}
            <script>
                {`
                function getStepDepth(stepId, logic) {
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
                }
                `}
            </script>
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
                    z-index: -1; /* Place connector line behind the step item */
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
