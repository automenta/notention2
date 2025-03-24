import React from 'react';

export default function StepToolSelect({ step, availableTools, onStepChange, index }) {
    return (
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
    );
}
