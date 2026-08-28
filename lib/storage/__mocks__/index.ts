import MemoryOnlyProvider, {mockStore, setMockStore} from '../providers/MemoryOnlyProvider';
import classifyIDBError from '../providers/IDBKeyValProvider/classifyError';
import classifySQLiteError from '../providers/classifySQLiteError';
import {StorageErrorClass} from '../errors';

const init = jest.fn(MemoryOnlyProvider.init);

init();

// Tests exercise retryOperation against both IndexedDB- and SQLite-shaped errors, so the mock facade
// classifies with each engine's real (native-dep-free) classifier in turn. Mirrors how the real facade
// delegates to the active provider; here we cover both engines since one mock stands in for all.
const classifyError = (error: unknown) => {
    const idbClass = classifyIDBError(error);
    return idbClass === StorageErrorClass.UNKNOWN ? classifySQLiteError(error) : idbClass;
};

const StorageMock = {
    init,
    classifyError: jest.fn(classifyError),
    getStorageProvider: jest.fn(() => MemoryOnlyProvider),
    getItem: jest.fn(MemoryOnlyProvider.getItem),
    multiGet: jest.fn(MemoryOnlyProvider.multiGet),
    setItem: jest.fn(MemoryOnlyProvider.setItem),
    multiSet: jest.fn(MemoryOnlyProvider.multiSet),
    mergeItem: jest.fn(MemoryOnlyProvider.mergeItem),
    multiMerge: jest.fn(MemoryOnlyProvider.multiMerge),
    removeItem: jest.fn(MemoryOnlyProvider.removeItem),
    removeItems: jest.fn(MemoryOnlyProvider.removeItems),
    clear: jest.fn(MemoryOnlyProvider.clear),
    getAllKeys: jest.fn(MemoryOnlyProvider.getAllKeys),
    getAll: jest.fn(MemoryOnlyProvider.getAll),
    getDatabaseSize: jest.fn(MemoryOnlyProvider.getDatabaseSize),
    keepInstancesSync: jest.fn(),

    getMockStore: jest.fn(() => mockStore),
    setMockStore: jest.fn((data) => setMockStore(data)),
};

export default StorageMock;
