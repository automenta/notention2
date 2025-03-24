import React from 'react';
import ReactJson from 'react-json-view';

export default function LogicStepItem({ step, index, availableTools, onStepChange, onDeleteStep, isDragging, draggingIndex }) {

    const getToolSchema = (toolName) => {
        const tool = availableTools.find(t => t.name === toolName);
        return tool?.schema;
    };

    const renderStepInput = () => {
        const schema = getToolSchema(step.tool);
        if (!schema || !schema.properties) {
            return <div>No schema available for this tool.</div>;
        }

        return Object.entries(schema.properties).map(([paramName, paramSchema]) => {
            const value = step.input[paramName] !== undefined ? step.input[paramName] : '';

            const handleInputChange = (paramValue) => {
                const updatedInput = { ...step.input, [paramName]: paramValue };
                onStepChange(index, 'input', updatedInput);
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
                    {renderStepInput()}
                </div>
                <div>Status: {step.status}</div>
            </div>
            <button onClick={() => onDeleteStep(index)} style={{ marginLeft: '10px' }}>Delete</button>
        </li>
    );
}
