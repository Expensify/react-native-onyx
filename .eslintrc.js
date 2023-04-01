module.exports = {
    extends: 'expensify',
    rules: {
        // Overwriting this for now because web-e will conflict with this
        'react/jsx-filename-extension': [1, {extensions: ['.js']}],
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
    env: {
        jest: true,
    },
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.native.js', '.web.js', '.ts'],
            },
        },
    },
    ignorePatterns: 'dist',
};
