import _ from 'underscore';
import fastMerge from '../../fastMerge';
import SyncQueue from '../../SyncQueue';

let storageMap = {};

const set = jest.fn((key, value) => new Promise((resolve) => {
    storageMap[key] = value;
    resolve(storageMap[key]);
}));

const setItemQueue = new SyncQueue(({key, value, shouldMerge}) => {
    if (shouldMerge) {
        const existingValue = storageMap[key];
        const newValue = _.isObject(existingValue)
            ? fastMerge(existingValue, value)
            : value;
        return set(key, newValue);
    }

    return set(key, value);
});

const localForageMockBase = {
    get storageMap() {
        return storageMap;
    },
    setItemQueue,
    localForageSet: set,
    setItem: jest.fn((key, value) => setItemQueue.push({key, value})),
    getItem: jest.fn(key => new Promise((resolve) => {
        resolve(storageMap[key]);
    })),
    removeItem: jest.fn(key => new Promise((resolve) => {
        delete storageMap[key];
        resolve();
    })),
    clear: jest.fn(() => new Promise((resolve) => {
        setItemQueue.abort();
        storageMap = {};
        resolve();
    })),
    getAllKeys: jest.fn(() => new Promise(resolve => resolve(_.keys(storageMap)))),
    setInitialMockData: jest.fn((data) => {
        storageMap = data;
    }),
    config: jest.fn(),
};

const localForageMock = {
    ...localForageMockBase,
    multiGet: jest.fn((keys) => {
        const getPromises = _.map(keys, key => new Promise(resolve => localForageMockBase.getItem(key).then(value => resolve([key, value]))));
        return Promise.all(getPromises);
    }),
    multiSet: jest.fn((pairs) => {
        const setPromises = _.map(pairs, ([key, value]) => localForageMockBase.setItem(key, value));
        return new Promise(resolve => Promise.all(setPromises).then(() => resolve(storageMap)));
    }),
    multiMerge: jest.fn((pairs) => {
        const mergePromises = _.map(pairs, ([key, value]) => localForageMockBase.setItemQueue.push({key, value, shouldMerge: true}));
        return new Promise(resolve => Promise.all(mergePromises).then(() => resolve(storageMap)));
    }),
};

export default localForageMock;
