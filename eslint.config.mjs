import expensify from 'eslint-config-expensify';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

export default [
    ...expensify,
    prettierConfig,
    {
        ignores: ['dist/**', 'node_modules/**', '.github/**', '*.d.ts', '*.config.js', '*.config.cjs', 'tests/types/**/*.ts'],
    },
    {
        // Overwriting this for now because web-e will conflict with this
        files: ['**/*.js', '**/*.jsx'],
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.website.js', '.desktop.js', '.native.js', '.ios.js', '.android.js', '.config.js', '.ts', '.tsx'],
                },
            },
        },
        rules: {
            'react/jsx-filename-extension': [1, {extensions: ['.js']}],
            'rulesdir/no-multiple-onyx-in-file': 'off',
            'import/extensions': [
                'error',
                'ignorePackages',
                {
                    js: 'never',
                    jsx: 'never',
                    ts: 'never',
                    tsx: 'never',
                },
            ],
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json',
                },
            },
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...tsPlugin.configs.stylistic.rules,
            'rulesdir/prefer-underscore-method': 'off',
            'react/jsx-props-no-spreading': 'off',
            'react/require-default-props': 'off',
            'react/jsx-filename-extension': ['error', {extensions: ['.tsx', '.jsx']}],
            'import/no-unresolved': 'error',
            'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}],
            '@typescript-eslint/consistent-type-imports': ['error', {prefer: 'type-imports'}],
            '@typescript-eslint/consistent-type-exports': ['error', {fixMixedExportsWithInlineTypeSpecifier: false}],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            'rulesdir/no-multiple-onyx-in-file': 'off',
            'valid-jsdoc': 'off',
            'rulesdir/prefer-import-module-contents': 'off',
            'es/no-optional-chaining': 'off',
            'es/no-nullish-coalescing-operators': 'off',
            // Disable JSDoc type rules for TypeScript files (TypeScript provides the types)
            'jsdoc/require-param': 'off',
            'jsdoc/require-param-type': 'off',
            'jsdoc/check-param-names': 'off',
            'jsdoc/check-tag-names': 'off',
            'jsdoc/check-types': 'off',
            'no-func-assign': 'off',
            'no-loop-func': 'off',
            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': 'error',
            'import/extensions': [
                'error',
                'ignorePackages',
                {
                    js: 'never',
                    jsx: 'never',
                    ts: 'never',
                    tsx: 'never',
                },
            ],
            'rulesdir/prefer-onyx-connect-in-libs': 'off',
            'rulesdir/no-onyx-connect': 'off',
            'rulesdir/prefer-actions-set-data': 'off',
        },
    },
    {
        files: ['tests/**/*.{js,jsx,ts,tsx}', 'jestSetup.js', 'lib/**/__mocks__/**/*.{js,ts}'],
        languageOptions: {
            globals: {
                jest: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                fail: 'readonly',
            },
        },
        rules: {
            '@lwc/lwc/no-async-await': 'off',
            'no-await-in-loop': 'off',
            'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
            'import/extensions': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            'no-restricted-imports': 'off',
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
                jest: 'readonly',
            },
        },
    },
];
