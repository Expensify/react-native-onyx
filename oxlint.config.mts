// Rules come from eslint-config-expensify's presets via buildOxlintConfig. The expensify preset is not used. Existing
// findings are baselined in config/oxlint/oxlint.seatbelt.tsv. The rest of this file is Onyx's own ignores, settings and
// overrides.
import {buildOxlintConfig, getPresetRuleEntry} from 'eslint-config-expensify/oxlint';

// The jest preset applies to Onyx's test and mock files only.
const JEST_FILES = ['tests/**', 'lib/**/__mocks__/**', 'jestSetup.js', 'jest-sequencer.js', 'jest-test-environment.ts'];

// Onyx's tsconfig rejects a standalone top-level await (TS1378), so the preset rule entries are awaited inline below.
export default await buildOxlintConfig({
    presets: ['browser', 'react', 'typescript', {preset: 'jest', files: JEST_FILES}, 'scripts', 'prettier'],
    // Keep oxlint's built-in exhaustive-deps instead of the hosted copy.
    nativeRules: ['react-hooks/exhaustive-deps'],
    ignorePatterns: ['dist/**', 'node_modules/**', '**/*.d.ts', '**/*.config.js', '**/*.config.cjs', 'tests/types/**/*.ts', 'cpp/**', 'bench-results/**', '.github/**'],
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
                // oxlint has no import resolution rule of its own, so the hosted one checks imports in TS files.
                'hosted/no-unresolved': 'error',
                // The typescript preset's options, plus a `_` prefix for parameters kept on purpose. An override replaces
                // the whole setting, so it starts from the preset's. oxlint's no-unused-vars needs
                // reportVarsOnlyUsedAsTypes to report what typescript-eslint's does.
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
        // Node tooling that runs on the current Node, so the old-browser `es/*` rules do not apply. `.mjs` imports need
        // their extension in Node, and the lint CLI prints its result with console.
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
        // The presets turn these on only for TypeScript files, and the config file is TypeScript: its rule names are
        // quoted keys, and it imports eslint-config-expensify, a devDependency.
        {
            files: ['oxlint.config.mts'],
            rules: {
                'hosted/naming-convention': 'off',
                'hosted/no-extraneous-dependencies': 'off',
            },
        },
        {
            files: ['.prettierrc.cjs', 'jest-sequencer.js', 'jestSetup.js', 'jest-test-environment.ts', 'buildDocs.ts'],
            env: {
                node: true,
            },
        },
        // The typescript preset's naming-convention, plus Onyx key strings (underscores) and numeric collection IDs as
        // object keys in tests. An override replaces the whole setting, so it starts from the preset's.
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
