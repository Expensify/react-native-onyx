const path = require('path');
const pak = require('../../../package.json');

module.exports = {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
        [
            'module-resolver',
            {
                extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
                alias: {
                    [pak.name]: path.join(__dirname, '../../../', pak.source),
                },
            },
        ],
    ],
};
