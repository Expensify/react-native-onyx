jest.mock('./lib/storage');
jest.mock('./lib/storage/NativeStorage', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/WebStorage', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/providers/IDBKeyVal', () => require('./lib/storage/__mocks__'));
jest.mock('react-native-device-info', () => ({getFreeDiskStorage: () => {}}));
jest.mock('react-native-quick-sqlite', () => ({
    open: () => ({execute: () => {}}),
}));
