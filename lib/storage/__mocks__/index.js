import _ from 'underscore';

let storageMap = {};

const localforageMock = {
    get storageMap() {
        return storageMap;
    },
    multiGet: jest.fn(keys => new Promise(resolve => resolve(_.get(storageMap, keys)))),
    multiMerge: jest.fn(pairs => new Promise(resolve => resolve())),
    getAllKeys: jest.fn(() => new Promise(resolve => resolve(_.keys(storageMap)))),
    setInitialMockData: jest.fn((data) => {
        storageMap = data;
    }),
    config: jest.fn(),
    getItem: jest.fn(key => new Promise((resolve) => {
        resolve(storageMap[key]);
    })),
    setItem: jest.fn((key, value) => new Promise((resolve) => {
        storageMap[key] = value;
        resolve();
    })),
    removeItem: jest.fn(key => new Promise((resolve) => {
        delete storageMap[key];
        resolve();
    })),
    clear: jest.fn(() => new Promise((resolve) => {
        storageMap = {};
        resolve();
    })),
};

export default localforageMock;
