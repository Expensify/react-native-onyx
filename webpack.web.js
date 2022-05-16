const {merge} = require('webpack-merge');
const path = require('path');
const commonConfig = require('./webpack.common');

module.exports = merge(commonConfig, {
    output: {
        filename: 'index.web.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            name: 'Onyx',
            type: 'umd',
        },
    },
    resolve: {
        // Resolve any web specific JS file as a normal JS file
        extensions: ['.web.js'],
    },
});
