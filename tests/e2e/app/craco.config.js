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
};
