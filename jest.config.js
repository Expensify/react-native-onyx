module.exports = {
    preset: 'react-native',
    roots: ['<rootDir>/lib', '<rootDir>/tests'],
    transform: {
        '\\.[jt]sx?$': 'babel-jest',
    },
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/tests/unit/mocks/', '<rootDir>/tests/e2e/'],
    testMatch: ['**/tests/unit/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    globals: {
        __DEV__: true,
        WebSocket: {},
    },
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['./jestSetup.js'],
    testTimeout: 10000,
    transformIgnorePatterns: ['node_modules/(?!(react-native|@react-native|@ngneat/falso|uuid)/)'],
};
