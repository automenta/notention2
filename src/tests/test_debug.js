import {describe, expect, it, vi} from 'vitest';
import debugTool from '../tools/debug.js';

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
        vi.mock('../../server.js', () => ({
            notes: new Map(),
        }));
        const input = {noteId: 'nonExistentId'};
        const result = await debugTool.invoke(input);
        expect(result).toContain('Note nonExistentId not found');
    });
});
