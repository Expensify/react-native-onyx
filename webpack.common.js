const path = require('path');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: './index.js',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        extensions: ['.jsx', '.js'],
    },
    plugins: [
        new CleanWebpackPlugin(),
    ],
};
