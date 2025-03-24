import React, { useState, useEffect } from 'react';
import ReactJson from 'react-json-view';

export default function LogicStepEditor({ logic, onChange, availableTools }) {
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
            i === index ? { ...step, [field]: value } : step
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
                const updatedInput = { ...step.input, [paramName]: paramValue };
                handleStepChange(index, 'input', updatedInput);
            };


            return (
                <div key={paramName} style={{ marginBottom: '10px' }}>
                    <label style={{ marginRight: '10px' }}>{paramName}:</label>
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
            <label style={{ marginRight: '10px' }}>Logic Steps:</label>
            <ul style={{ padding: 0 }}>
                {logic.map((step, index) => (
                    <li
                        key={step.id}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
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
                                    onChange={e => handleStepChange(index, 'tool', e.target.value)}
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
                        <button onClick={() => handleDeleteStep(index)} style={{ marginLeft: '10px' }}>Delete</button>
                    </li>
                ))}
            </ul>
            <button onClick={handleAddStep}>Add Step</button>
            <style jsx>{`
                .dragging {
                    opacity: 0.5;
                    border: 2px dashed #999;
                    background-color: #fafafa;
                }
            `}</style>
        </div>
    );
}
