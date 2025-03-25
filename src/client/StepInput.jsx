import React from 'react';
import ReactJson from 'react-json-view';

export default function StepInput({step, index, availableTools, onStepChange}) {

    const getToolSchema = (toolName) => {
        const tool = availableTools.find(t => t.name === toolName);
        return tool?.schema;
    };

    const renderStepInputFields = () => {
        const schema = getToolSchema(step.tool);
        if (!schema || !schema.properties) {
            return <div>No schema available for this tool.</div>;
        }

        return Object.entries(schema.properties).map(([paramName, paramSchema]) => {
            const value = step.input[paramName] !== undefined ? step.input[paramName] : '';

            const handleInputChange = (paramValue) => {
                const updatedInput = {...step.input, [paramName]: paramValue};
                onStepChange(index, 'input', updatedInput);
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
            {renderStepInputFields()}
        </div>
    );
}
