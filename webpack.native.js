const {merge} = require('webpack-merge');
const path = require('path');
const commonConfig = require('./webpack.common');

module.exports = merge(commonConfig, {
    output: {
        filename: 'index.native.js',
        path: path.resolve(__dirname, 'dist'),
    },
    externals: {
        'react-native': true,
    },
    resolve: {
        // Resolve any native specific JS file as a normal JS file
        extensions: ['.native.js'],
    },
});
