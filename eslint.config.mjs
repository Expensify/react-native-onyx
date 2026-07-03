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
            'react/prop-types': 'off',
            'react/require-default-props': 'off',
        },
    },
    {
        files: ['.prettierrc.cjs', 'jest-sequencer.js', 'jestSetup.js', 'jest-test-environment.ts', 'buildDocs.ts'],
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        files: ['lib/OnyxUtils.ts'],
        rules: {
            '@typescript-eslint/no-use-before-define': 'off',
        },
    },
    // Flat config replaces the whole naming-convention array, so this repeats eslint-config-expensify/typescript
    // and adds objectLiteralProperty exceptions for Onyx key strings (underscores) and numeric collection IDs.
    {
        files: ['tests/**/*'],
        rules: {
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: ['variable', 'property'],
                    format: null,
                    filter: {
                        regex: '^__esModule$',
                        match: true,
                    },
                },
                {
                    selector: ['variable', 'property'],
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    filter: {
                        regex: '^private_[a-z][a-zA-Z0-9]*$',
                        match: false,
                    },
                },
                {
                    selector: 'objectLiteralProperty',
                    format: null,
                    filter: {
                        regex: '_',
                        match: true,
                    },
                },
                {
                    selector: 'objectLiteralProperty',
                    format: null,
                    filter: {
                        regex: '^[0-9]+$',
                        match: true,
                    },
                },
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                },
                {
                    selector: ['typeLike', 'enumMember'],
                    format: ['PascalCase'],
                },
                {
                    selector: ['parameter', 'method'],
                    format: ['camelCase', 'PascalCase'],
                    leadingUnderscore: 'allow',
                },
            ],
        },
    },
    {
        files: ['tests/**/*', 'jestSetup.js', 'lib/**/__mocks__/**/*'],
        rules: {
            'import/extensions': 'off',
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
