module.exports = {
    extends: ['expensify', 'prettier'],
    parser: '@babel/eslint-parser',
    env: {
        jest: true,
    },
    overrides: [
        {
            files: ['*.js', '*.jsx'],
            settings: {
                'import/resolver': {
                    node: {
                        extensions: ['.js', '.website.js', '.desktop.js', '.native.js', '.ios.js', '.android.js', '.config.js', '.ts', '.tsx'],
                    },
                },
            },
            rules: {
                // Overwriting this for now because web-e will conflict with this
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
            files: ['*.ts', '*.tsx'],
            extends: ['expensify', 'plugin:@typescript-eslint/recommended', 'plugin:@typescript-eslint/stylistic', 'plugin:import/typescript', 'prettier', 'plugin:prettier/recommended'],
            plugins: ['react', 'react-native', 'import', '@typescript-eslint'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: './tsconfig.json',
            },
            rules: {
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
            },
        },
    ],
};
