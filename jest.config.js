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
    timers: 'fake',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect', './jestSetup.js'],
    testTimeout: 60000,
};
