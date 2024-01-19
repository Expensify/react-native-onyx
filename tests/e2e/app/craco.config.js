const {getLoader, loaderByName} = require('@craco/craco');
const {CracoAliasPlugin} = require('react-app-alias-ex');

module.exports = {
    plugins: [
        {
            plugin: CracoAliasPlugin,
            options: {},
        },
    ],
    eslint: {
        enable: false,
    },
    webpack: {
        configure: (webpackConfig) => {
            const {isFound, match} = getLoader(webpackConfig, loaderByName('babel-loader'));
            if (isFound) {
                match.loader.include = /\.[jt]sx?$/;
            }
            webpackConfig.resolve.extensions.push('.ts', '.tsx');
            return webpackConfig;
        },
    },
};
