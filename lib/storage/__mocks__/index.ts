import MemoryOnlyProvider, {mockStore, setMockStore} from '../providers/MemoryOnlyProvider';

const init = jest.fn(MemoryOnlyProvider.init);

init();

const StorageMock = {
    init,
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
    getDatabaseSize: jest.fn(MemoryOnlyProvider.getDatabaseSize),
    keepInstancesSync: jest.fn(),

    getMockStore: jest.fn(() => mockStore),
    setMockStore: jest.fn((data) => setMockStore(data)),
};

export default StorageMock;
