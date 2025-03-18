import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    root: 'src/client',
    build: { outDir: '../../dist' },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './tests/setup.js', // Add if you create this file
    },
});
