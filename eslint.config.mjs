import browserConfig from 'eslint-config-expensify/browser';
import reactConfig from 'eslint-config-expensify/react';
import scriptsConfig from 'eslint-config-expensify/scripts';
import tsExpensifyConfig from 'eslint-config-expensify/typescript';
import jestConfig from 'eslint-config-expensify/jest';
import prettierConfig from 'eslint-config-prettier';
import seatbelt from 'eslint-seatbelt';
import rulesdir from 'eslint-plugin-rulesdir';
import {defineConfig, globalIgnores} from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const expensifyConfigDirectory = path.dirname(require.resolve('eslint-config-expensify'));
rulesdir.RULES_DIR = path.resolve(expensifyConfigDirectory, 'eslint-plugin-expensify');

export default defineConfig([
    seatbelt.configs.enable,
    globalIgnores(['dist/**', 'node_modules/**', '**/*.d.ts', '**/*.config.js', '**/*.config.cjs', 'tests/types/**/*.ts', 'cpp/**', 'bench-results/**', '.github/**']),
    ...browserConfig,
    ...reactConfig,
    ...tsExpensifyConfig,
    ...jestConfig,
    ...scriptsConfig,
    {
        plugins: {
            rulesdir,
        },
        settings: {
            seatbelt: {
                seatbeltFile: path.join(dirname, 'eslint.seatbelt.tsv'),
                threadsafe: true,
            },
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json',
                },
            },
        },
        rules: {
            'class-methods-use-this': 'off',
            'react/prop-types': 'off',
            'react/require-default-props': 'off',
            'react/jsx-props-no-spreading': 'off',

            // Onyx is this package; multiple instances are intentional in tests and mocks.
            'rulesdir/no-multiple-onyx-in-file': 'off',
        },
    },
    {
        files: ['tests/**/*', 'jestSetup.js', 'lib/**/__mocks__/**/*'],
        rules: {
            'import/extensions': 'off',
            'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
        },
    },
    {
        files: ['**/*.native.ts', '**/*.native.tsx'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
    {
        files: ['lib/storage/providers/MemoryOnlyProvider.ts'],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
    prettierConfig,
]);
