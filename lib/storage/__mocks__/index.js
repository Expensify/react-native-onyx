import MemoryOnlyProvider, {mockStore, mockSet, setMockStore} from '../providers/MemoryOnlyProvider';

const provider = {
    getItem: jest.fn(MemoryOnlyProvider.getItem),
    multiGet: jest.fn(MemoryOnlyProvider.multiGet),
    setItem: jest.fn(MemoryOnlyProvider.setItem),
    multiSet: jest.fn(MemoryOnlyProvider.multiSet),
    mergeItem: jest.fn(MemoryOnlyProvider.mergeItem),
    multiMerge: jest.fn(MemoryOnlyProvider.multiMerge),
    removeItem: jest.fn(MemoryOnlyProvider.removeItem),
    removeItems: jest.fn(MemoryOnlyProvider.removeItems),
    clear: jest.fn(MemoryOnlyProvider.clear),
    setMemoryOnlyKeys: jest.fn(MemoryOnlyProvider.setMemoryOnlyKeys),
    getAllKeys: jest.fn(MemoryOnlyProvider.getAllKeys),
    getDatabaseSize: jest.fn(MemoryOnlyProvider.getDatabaseSize),
    mockSet,
    getMockStore: jest.fn(() => mockStore),
    setMockStore: jest.fn((data) => setMockStore(data)),
};

export default provider;
