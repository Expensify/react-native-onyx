module.exports = {
    presets: [
        require('metro-react-native-babel-preset'),
        '@babel/preset-react',
        '@babel/preset-env',
        '@babel/preset-flow',
    ],
    plugins: [
        '@babel/plugin-proposal-class-properties',
    ],
};
