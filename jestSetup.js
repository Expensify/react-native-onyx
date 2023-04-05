jest.mock('./lib/storage');
jest.mock('./lib/storage/NativeStorage', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/WebStorage', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/providers/LocalForage', () => require('./lib/storage/__mocks__'));
