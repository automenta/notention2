import {describe, expect, it, vi} from 'vitest';
import debugTool from '../tools/builtin/debug';

describe('Debug Tool', () => {
    it('should return debug information for a given noteId', async () => {
        const mockNotes = new Map([
            ['testNoteId', {
                id: 'testNoteId',
                title: 'Test Note',
                status: 'pending',
                memory: [],
                references: []
            }]
        ]);

        // Mock the import('../../server.js') to return the mockNotes map
        vi.mock('../../server.js', () => ({
            notes: mockNotes,
        }));


        const input = {noteId: 'testNoteId'};
        const result = await debugTool.invoke(input);
        const parsedResult = JSON.parse(result);

        expect(parsedResult).toHaveProperty('id', 'testNoteId');
        expect(parsedResult).toHaveProperty('title', 'Test Note');
        expect(parsedResult).toHaveProperty('status', 'pending');
        expect(parsedResult).toHaveProperty('memory', []);
        expect(parsedResult).toHaveProperty('references', []);
    });

    it('should return "Note not found" if noteId does not exist', async () => {
        // Mock the import('../../server.js') to return an empty notes map or a map without 'nonExistentId'
        vi.mock('../../server.js', () => ({
            notes: new Map(), // Empty map to simulate note not found
        }));
        const input = {noteId: 'nonExistentId'};
        const result = await debugTool.invoke(input);
        expect(result).toContain('Note nonExistentId not found');
    });
});
