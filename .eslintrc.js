module.exports = {
    extends: ['expensify', 'prettier'],
    rules: {
        // Overwriting this for now because web-e will conflict with this
        'react/jsx-filename-extension': [1, {extensions: ['.js']}],
        'rulesdir/no-multiple-onyx-in-file': 'off',
    },
    env: {
        jest: true,
    },
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.native.js', '.web.js'],
            },
        },
    },
    ignorePatterns: 'dist',
};
