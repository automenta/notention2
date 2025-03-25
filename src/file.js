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
        await writeFile(join(this.notesDir, `${note.id}.json`), JSON.stringify(note));
    }

    async deleteNote(noteId) {
        await unlink(join(this.notesDir, `${noteId}.json`));
        this.notes.delete(noteId);
    }

    async removeReferences(noteId) {
        for (const [id, note] of this.notes.entries()) {
            if (note.references.includes(noteId)) {
                note.references = note.references.filter(ref => ref !== noteId);
                await this.saveNote(note);
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
