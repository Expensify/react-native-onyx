const {merge} = require('webpack-merge');
const commonConfig = require('./webpack.common');

/**
 * Configuration for the local dev server
 * @param {Object} env
 * @returns {Configuration}
 */
module.exports = merge(commonConfig, {
    mode: 'development',
});
