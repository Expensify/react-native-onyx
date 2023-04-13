jest.mock('./lib/storage');
jest.mock('./lib/storage/NativeStorage', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/WebStorage', () => require('./lib/storage/__mocks__'));
jest.mock('./lib/storage/providers/LocalForage', () => require('./lib/storage/__mocks__'));

// Jest doesn't recognize native file extensions such as `.web.js` or `.native.js`.
// This is why we need to default one of the platforms implementations
jest.mock('./lib/OnyxMerge', () => require('./lib/OnyxMerge.web'));
