const {merge} = require('webpack-merge');
const commonConfig = require('./webpack.common');

module.exports = merge(commonConfig, {
    output: {
        filename: 'index.native.js',
        library: {
            name: 'react-native-onyx',
        }
    },
    resolve: {
        // Resolve any native specific JS file as a normal JS file
        extensions: ['.native.js'],
    },
});
