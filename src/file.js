import {readdir, readFile, unlink, writeFile} from 'node:fs/promises';
import {join} from 'path';
import * as fs from "node:fs";
import {NoteSchema} from './schemas.js';

export class File {
    constructor(notesDir) {
        this.notesDir = notesDir;
        fs.mkdirSync(this.notesDir, {recursive: true});
        this.notes = new Map();
        this.loadNotes();
    }

    async loadNotes() {
        const files = await readdir(this.notesDir);
        for (const file of files) {
            try {
                const data = JSON.parse(await readFile(join(this.notesDir, file), 'utf8'));
                let note;
                try {
                    note = NoteSchema.parse(data); // Validate note data against schema
                } catch (validationError) {
                    console.error(`Validation error loading note ${file}: ${validationError.errors}`);
                    continue; // Skip loading this note and proceed to the next
                }
                this.notes.set(note.id, note);
            } catch (e) {
                console.error(`Error loading note ${file}: ${e}`);
            }
        }
        return this.notes;
    }

    async saveNote(note) {
        try {
            await writeFile(join(this.notesDir, `${note.id}.json`), JSON.stringify(note));
        } catch (error) {
            console.error(`Error saving note ${note.id} to file: ${error}`);
            throw error; // Re-throw to allow caller to handle or log
        }
    }

    async deleteNote(noteId) {
        try {
            await unlink(join(this.notesDir, `${noteId}.json`));
            this.notes.delete(noteId);
        } catch (error) {
            console.error(`Error deleting note ${noteId} from file: ${error}`);
            throw error; // Re-throw to allow caller to handle or log
        }
    }

    async removeReferences(noteId) {
        for (const [id, note] of this.notes.entries()) {
            if (note.references.includes(noteId)) {
                note.references = note.references.filter(ref => ref !== noteId);
                try {
                    await this.saveNote(note);
                } catch (error) {
                    console.error(`Error updating references for note ${note.id} during removeReferences of note ${noteId}: ${error}`);
                    // Decide if you want to re-throw or just log and continue.
                    // For now, logging and continuing to process other notes.
                }
            }
        }
    }

    getNote(noteId) {
        return this.notes.get(noteId);
    }

    getNotes() {
        return Array.from(this.notes.values());
    }
}
