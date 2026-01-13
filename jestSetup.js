jest.mock('./lib/storage');
jest.mock('./lib/storage/platforms/index.native', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/platforms/index', () => require('./lib/storage/__mocks__'));

jest.mock('react-native-device-info', () => ({getFreeDiskStorage: () => {}}));
jest.mock('react-native-nitro-sqlite', () => ({
    open: () => ({execute: () => {}}),
    enableSimpleNullHandling: () => undefined,
}));

jest.useRealTimers();

const unstable_batchedUpdates_jest = require('react-test-renderer').unstable_batchedUpdates;
require('./lib/batch.native').default = unstable_batchedUpdates_jest;
