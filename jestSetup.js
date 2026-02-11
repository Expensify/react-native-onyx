jest.mock('./lib/storage');
jest.mock('./lib/storage/platforms/index.native', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/platforms/index', () => require('./lib/storage/__mocks__'));

// Mock react-native-nitro-sqlite for native provider tests
jest.mock('react-native-nitro-sqlite', () => ({
    open: jest.fn(() => ({
        execute: jest.fn(() => ({rows: {length: 0, item: () => null, _array: []}})),
        executeAsync: jest.fn(() => Promise.resolve({rows: {length: 0, item: () => null, _array: []}})),
        executeBatch: jest.fn(),
        executeBatchAsync: jest.fn(() => Promise.resolve()),
    })),
    enableSimpleNullHandling: jest.fn(),
}));

// Mock react-native-device-info for native provider
jest.mock('react-native-device-info', () => ({
    getFreeDiskStorage: jest.fn(() => Promise.resolve(Number.POSITIVE_INFINITY)),
}));

// Mock react-native-nitro-modules for BufferStore HybridObject
jest.mock('react-native-nitro-modules', () => ({
    NitroModules: {
        createHybridObject: jest.fn(() => {
            throw new Error('NitroModules not available in test environment');
        }),
    },
}));

// Mock react-native-worklets-core for NativeFlushWorker
jest.mock('react-native-worklets-core', () => ({
    Worklets: {
        createContext: jest.fn(() => ({
            name: 'OnyxFlushWorker',
            addDecorator: jest.fn(),
            createRunAsync: jest.fn((fn) => (...args) => Promise.resolve(fn(...args))),
            runAsync: jest.fn((fn) => Promise.resolve(fn())),
        })),
        createSharedValue: jest.fn((value) => ({value})),
        createRunOnJS: jest.fn((fn) => fn),
        runOnJS: jest.fn((fn) => Promise.resolve(fn())),
        getCurrentThreadId: jest.fn(() => 0),
        defaultContext: {
            name: 'default',
            addDecorator: jest.fn(),
            createRunAsync: jest.fn((fn) => (...args) => Promise.resolve(fn(...args))),
            runAsync: jest.fn((fn) => Promise.resolve(fn())),
        },
        currentContext: undefined,
    },
}));

jest.useRealTimers();
