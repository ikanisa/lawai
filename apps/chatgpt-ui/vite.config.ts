import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                'corpus-explorer': resolve(__dirname, 'src/widgets/corpus-explorer.html'),
                'governance-dashboard': resolve(__dirname, 'src/widgets/governance-dashboard.html'),
                'release-readiness': resolve(__dirname, 'src/widgets/release-readiness.html'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
            },
        },
    },
    server: {
        port: 5173,
    },
});
