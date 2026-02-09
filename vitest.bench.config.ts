import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            // Ensure we use the web (IDB) storage provider, not the native one
            './platforms': path.resolve(__dirname, 'lib/storage/platforms/index.ts'),
        },
    },
    define: {
        // Onyx references `global` (a Node/RN global) which doesn't exist in browsers.
        // Map it to `globalThis` which works in all environments.
        global: 'globalThis',
    },
    test: {
        browser: {
            provider: playwright(),
            enabled: true,
            headless: true,
            instances: [{browser: 'chromium'}],
        },
        benchmark: {
            include: ['benchmarks/**/*.bench.ts'],
        },
        // Don't use the __mocks__ directory — we want real storage providers
        automock: false,
    },
});
