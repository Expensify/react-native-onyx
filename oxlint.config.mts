// Rules come from the eslint-config-expensify presets (config/oxlint/presets.mjs), converted on every run by
// config/oxlint/derive.mjs. This file only adds Onyx's own ignores, settings and overrides.
import {extendOxlintConfig} from './config/oxlint/derive.mjs';

export default extendOxlintConfig({
    ignorePatterns: [
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
    ],
    settings: {
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true,
                project: './tsconfig.json',
            },
        },
    },
    overrides: [
        {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            rules: {
                'hosted/prop-types': 'off',
                'hosted/require-default-props': 'off',
            },
        },
        {
            files: ['.prettierrc.cjs', 'jest-sequencer.js', 'jestSetup.js', 'jest-test-environment.ts', 'buildDocs.ts'],
            env: {
                node: true,
            },
        },
        // Overriding replaces the whole naming-convention array, so this repeats eslint-config-expensify/typescript
        // and allows Onyx key strings (underscores) and numeric collection IDs as object keys.
        {
            files: ['tests/**/*'],
            rules: {
                'hosted/naming-convention': [
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
            env: {
                jest: true,
            },
        },
        {
            files: ['tests/**/*Test.ts', 'tests/perf-test/**/*'],
            rules: {
                'typescript/dot-notation': 'off',
            },
        },
        {
            files: ['tests/perf-test/**/*'],
            rules: {
                'unicorn/prefer-at': 'off',
            },
        },
    ],
});
