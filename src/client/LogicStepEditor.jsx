import React, { useState, useEffect } from 'react';

export default function LogicStepEditor({ logic, onChange, availableTools }) {
    const handleAddStep = () => {
        const newStep = {
            id: `step-${Date.now()}`,
            tool: availableTools.length > 0 ? availableTools[0].name : '', // Default to first tool if available
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

    return (
        <div>
            <label style={{ marginRight: '10px' }}>Logic Steps:</label>
            <ul>
                {logic.map((step, index) => (
                    <li key={step.id} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '5px', borderRadius: '4px' }}>
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
                            <label style={{ marginRight: '10px' }}>Input:</label>
                            <input
                                type="text"
                                value={JSON.stringify(step.input)}
                                onChange={e => {
                                    try {
                                        handleStepChange(index, 'input', JSON.parse(e.target.value));
                                    } catch (error) {
                                        console.error("Error parsing JSON input:", error);
                                        // Optionally handle invalid JSON input, maybe show an error message
                                    }
                                }}
                                style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                        </div>
                        <div>Status: {step.status}</div>
                    </li>
                ))}
            </ul>
            <button onClick={handleAddStep}>Add Step</button>
        </div>
    );
}
