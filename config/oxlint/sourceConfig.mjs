// Oxlint's config is generated from this file (see derive.mjs). It is a copy of eslint.config.mjs without the
// rulesdir setup, so Oxlint keeps working after eslint.config.mjs is deleted. Until then, change both files together.
import browserConfig from 'eslint-config-expensify/browser';
import jestConfig from 'eslint-config-expensify/jest';
import reactConfig from 'eslint-config-expensify/react';
import scriptsConfig from 'eslint-config-expensify/scripts';
import tsExpensifyConfig from 'eslint-config-expensify/typescript';
import prettierConfig from 'eslint-config-prettier';
import {defineConfig, globalIgnores} from 'eslint/config';
import globals from 'globals';

import downgradeDebtRules from '../lintDebt.mjs';

const configs = defineConfig([
    globalIgnores([
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.js',
        '**/*.config.cjs',
        'tests/types/**/*.ts',
        'cpp/**',
        'bench-results/**',
        '.github/**',
        'oxlint.config.mts',
        'config/oxlint/**',
    ]),
    ...browserConfig,
    ...reactConfig,
    ...tsExpensifyConfig,
    ...jestConfig.map((config) => ({
        ...config,
        files: ['tests/**', 'lib/**/__mocks__/**', 'jestSetup.js', 'jest-sequencer.js', 'jest-test-environment.ts'],
    })),
    ...scriptsConfig,
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
    // A later block replaces the whole naming-convention array, so this repeats eslint-config-expensify/typescript
    // and allows Onyx key strings (underscores) and numeric collection IDs as object keys.
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
    {
        files: ['tests/**/*Test.ts', 'tests/perf-test/**/*'],
        rules: {
            '@typescript-eslint/dot-notation': 'off',
        },
    },
    {
        files: ['tests/perf-test/**/*'],
        rules: {
            'rulesdir/prefer-at': 'off',
        },
    },
    prettierConfig,
]);

export default configs.map((entry) => (entry.rules ? {...entry, rules: downgradeDebtRules(entry.rules)} : entry));
