const path = require('path');
const _ = require('underscore');
const pkg = require('./package.json');

module.exports = {
    mode: 'production',
    entry: './index.js',
    resolve: {
        extensions: ['.jsx', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules)/,
                use: {
                    loader: 'babel-loader',
                },
            },
        ],
    },
    externals: [
        'react-native',
        /^expensify-common\/.+$/,
        /^lodash\/.+$/,
        ..._.keys(pkg.peerDependencies),
        ..._.keys(pkg.dependencies),
    ],
    output: {
        path: path.resolve(__dirname, 'dist'),
        library: {
            name: 'react-native-onyx',
            type: 'umd'
        },
    }
};
