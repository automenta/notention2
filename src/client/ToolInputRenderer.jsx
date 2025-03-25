import React from 'react';
import ReactJson from 'react-json-view';

export default function ToolInputRenderer({schema, input, onInputChange}) {
    if (!schema || !schema.properties) {
        return <div>No schema available for this tool.</div>;
    }

    return Object.entries(schema.properties).map(([paramName, paramSchema]) => {
        const value = input[paramName] !== undefined ? input[paramName] : '';

        const handleInputChange = (paramValue) => {
            onInputChange(paramName, paramValue);
        };

        const inputType = paramSchema.type;

        const handleInputChangeText = (event) => {
            handleInputChange(event.target.value);
        };

        const handleInputChangeNumber = (event) => {
            handleInputChange(Number(event.target.value));
        };

        const handleInputChangeBoolean = (event) => {
            handleInputChange(event.target.checked);
        };

        if (inputType === 'string') {
            return (
                <div key={paramName} style={{marginBottom: '10px'}}>
                    <label style={{marginRight: '10px'}}>{paramName}:</label>
                    <textarea
                        value={value || ''}
                        onChange={handleInputChangeText}
                        style={{width: '100%', minHeight: '50px'}}
                    />
                </div>
            );
        } else if (inputType === 'number') {
            return (
                <div key={paramName} style={{marginBottom: '10px'}}>
                    <label style={{marginRight: '10px'}}>{paramName}:</label>
                    <input
                        type="number"
                        value={value || 0}
                        onChange={handleInputChangeNumber}
                    />
                </div>
            );
        } else if (inputType === 'boolean') {
            return (
                <div key={paramName} style={{marginBottom: '10px'}}>
                    <label style={{marginRight: '10px'}}>{paramName}:</label>
                    <input
                        type="checkbox"
                        checked={value || false}
                        onChange={handleInputChangeBoolean}
                    />
                </div>
            );
        } else if (paramSchema.enum) {
            return (
                <div key={paramName} style={{marginBottom: '10px'}}>
                    <label style={{marginRight: '10px'}}>{paramName}:</label>
                    <select
                        value={value || paramSchema.enum[0]}
                        onChange={(e) => handleInputChange(e.target.value)}
                    >
                        {paramSchema.enum.map(enumValue => (
                            <option key={enumValue} value={enumValue}>{enumValue}</option>
                        ))}
                    </select>
                </div>
            );
        } else {
            return (
                <div key={paramName} style={{marginBottom: '10px'}}>
                    <label style={{marginRight: '10px'}}>{paramName}:</label>
                    <ReactJson
                        src={value || null}
                        onEdit={(val) => handleInputChange(val.updated_src)}
                        onAdd={(val) => handleInputChange(val.updated_src)}
                        onDelete={(val) => handleInputChange(val.updated_src)}
                        displayObjectSize={false}
                        displayDataTypes={false}
                    />
                </div>
            );
        }
    });
}
