const {merge} = require('webpack-merge');
const commonConfig = require('./webpack.common');

module.exports = merge(commonConfig, {
    resolve: {
        // Resolve any web specific JS file as a normal JS file
        extensions: ['.web.js'],
    },
});
