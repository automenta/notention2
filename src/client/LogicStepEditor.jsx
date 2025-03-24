import React from 'react';

export default function LogicStepEditor({ logic, onChange }) {
    const handleAddStep = () => {
        const newStep = {
            id: `step-${Date.now()}`,
            tool: '',
            input: {},
            dependencies: [],
            status: 'pending'
        };
        onChange([...logic, newStep]);
    };

    return (
        <div>
            <label style={{ marginRight: '10px' }}>Logic Steps:</label>
            <ul>
                {logic.map((step, index) => (
                    <li key={step.id} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '5px', borderRadius: '4px' }}>
                        <div><strong>Step {index + 1}:</strong></div>
                        <div>Tool: {step.tool}</div>
                        <div>Input: {JSON.stringify(step.input)}</div>
                    </li>
                ))}
            </ul>
            <button onClick={handleAddStep}>Add Step</button>
        </div>
    );
}
