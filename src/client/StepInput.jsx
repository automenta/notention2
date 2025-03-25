import React from 'react';
import {getToolSchema} from './tool_utils';
import ToolInputRenderer from './ToolInputRenderer.jsx';

export default function StepInput({step, index, availableTools, onStepChange}) {
    const schema = getToolSchema(availableTools, step.tool);

    const handleInputChange = (paramName, paramValue) => {
        const updatedInput = {...step.input, [paramName]: paramValue};
        onStepChange(index, 'input', updatedInput);
    };

    return (
        <div>
            <ToolInputRenderer
                schema={schema}
                input={step.input}
                onInputChange={handleInputChange}
            />
        </div>
    );
}
