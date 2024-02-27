jest.mock('./lib/storage');
jest.mock('./lib/storage/platforms/NativeStorage', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/platforms/WebStorage', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/providers/IDBKeyValProvider', () => require('./lib/storage/__mocks__'));

jest.mock('react-native-device-info', () => ({getFreeDiskStorage: () => {}}));
jest.mock('react-native-quick-sqlite', () => ({
    open: () => ({execute: () => {}}),
}));

jest.useRealTimers();

const unstable_batchedUpdates_jest = require('react-test-renderer').unstable_batchedUpdates;
require('./lib/batch.native').default = unstable_batchedUpdates_jest;
