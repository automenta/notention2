import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import NoteList from '../client/NoteList.jsx';

describe('Core Loop', () => {
    it('renders note list and handles CRUD', () => {
        const notes = [
            {id: '1', title: 'Test Note', status: 'pending'},
        ];
        const onSelect = vi.fn();
        const onDelete = vi.fn();
        render(<NoteList notes={notes} onSelect={onSelect} onDelete={onDelete}/>);
        expect(screen.getByText('Test Note (pending)')).toBeInTheDocument();
        screen.getByText('Delete').click();
        expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('runs a note with a plan', async () => {
        const notes = [
            {
                id: '1',
                title: 'Test Plan',
                status: 'pending',
                logic: [{id: 's1', tool: 'summarize', input: {text: 'Test'}, status: 'pending'}]
            },
        ];
        const onSelect = vi.fn();
        const onDelete = vi.fn();
        render(<NoteList notes={notes} onSelect={onSelect} onDelete={onDelete}/>);
        expect(screen.getByText('Test Plan (pending)')).toBeInTheDocument();
    });
});
