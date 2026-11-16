import {buildOxlintConfig, getPresetRuleEntry} from 'eslint-config-expensify/oxlint';

const JEST_FILES = ['tests/**', 'lib/**/__mocks__/**', 'jestSetup.js', 'jest-sequencer.js', 'jest-test-environment.ts'];

// Onyx's tsconfig rejects a standalone top-level await (TS1378), so the preset rule entries are awaited inline below.
export default await buildOxlintConfig({
    presets: ['browser', 'react', 'typescript', {preset: 'jest', files: JEST_FILES}, 'scripts', 'prettier'],
    nativeRules: ['react-hooks/exhaustive-deps'],
    ignorePatterns: ['dist/**', 'node_modules/**', '**/*.d.ts', '**/*.config.js', '**/*.config.cjs', 'tests/types/**/*.ts', '.github/**'],
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
            files: ['**/*.ts', '**/*.tsx'],
            rules: {
                // oxlint has no import resolution rule, so the hosted one checks TS imports.
                'hosted/no-unresolved': 'error',
                // The preset's options plus a `_` args prefix. oxlint needs reportVarsOnlyUsedAsTypes to match typescript-eslint.
                'no-unused-vars': [
                    'error',
                    {
                        ...(await getPresetRuleEntry<[Record<string, unknown>]>('typescript', '@typescript-eslint/no-unused-vars'))[1],
                        argsIgnorePattern: '^_',
                        reportVarsOnlyUsedAsTypes: true,
                    },
                ],
            },
        },
        // Node tooling: the old-browser es/* rules do not apply, .mjs imports need extensions, the CLI uses console.
        {
            files: ['oxlint.config.mts', 'config/oxlint/**/*'],
            env: {
                node: true,
            },
            rules: {
                'es/no-nullish-coalescing-operators': 'off',
                'es/no-optional-chaining': 'off',
                'import/extensions': 'off',
                'no-console': 'off',
            },
        },
        // The presets enable these for TypeScript files only. This config is TypeScript, with quoted rule keys and a devDependency import.
        {
            files: ['oxlint.config.mts'],
            rules: {
                'hosted/naming-convention': 'off',
                'hosted/no-extraneous-dependencies': 'off',
            },
        },
        {
            files: ['jest-sequencer.js', 'jestSetup.js', 'jest-test-environment.ts', 'buildDocs.ts'],
            env: {
                node: true,
            },
        },
        // The preset's naming-convention plus underscored Onyx keys and numeric collection IDs as object keys in tests.
        {
            files: ['tests/**/*'],
            rules: {
                'hosted/naming-convention': [
                    ...(await getPresetRuleEntry('typescript', '@typescript-eslint/naming-convention')),
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
                ],
            },
        },
        {
            files: JEST_FILES,
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
