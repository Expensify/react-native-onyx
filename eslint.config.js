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
            '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
            '@typescript-eslint/consistent-type-imports': ['error', {prefer: 'type-imports'}],
            '@typescript-eslint/consistent-type-exports': ['error', {fixMixedExportsWithInlineTypeSpecifier: false}],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
            '@typescript-eslint/consistent-type-definitions': 'off',
            'rulesdir/no-multiple-onyx-in-file': 'off',
            'valid-jsdoc': 'off',
            'rulesdir/prefer-import-module-contents': 'off',
            'es/no-optional-chaining': 'off',
            'es/no-nullish-coalescing-operators': 'off',
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
        },
    },
    {
        files: ['tests/**/*.{js,jsx,ts,tsx}'],
        rules: {
            '@lwc/lwc/no-async-await': 'off',
            'no-await-in-loop': 'off',
            'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
        },
    },
    {
        files: ['jestSetup.cjs'],
        languageOptions: {
            globals: {
                jest: 'readonly',
            },
        },
        rules: {
            'import/extensions': 'off',
        },
    },
];
