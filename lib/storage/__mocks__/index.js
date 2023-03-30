import _ from 'underscore';
import fastMerge from '../../fastMerge';
import SyncQueue from '../../SyncQueue';

let storageMapInternal = {};

const set = jest.fn((key, value) => {
    // eslint-disable-next-line no-param-reassign
    storageMapInternal[key] = value;
    return Promise.resolve(storageMapInternal[key]);
});

const setItemQueue = new SyncQueue(({key, value, shouldMerge}) => {
    if (shouldMerge) {
        const existingValue = storageMapInternal[key];
        const newValue = _.isObject(existingValue)
            ? fastMerge(existingValue, value)
            : value;
        return set(key, newValue);
    }

    return set(key, value);
});

const localForageMock = {
    setItem(key, value) {
        return setItemQueue.push({key, value});
    },
    multiSet(pairs) {
        const setPromises = _.map(pairs, ([key, value]) => this.setItem(key, value));
        return new Promise(resolve => Promise.all(setPromises).then(() => resolve(storageMapInternal)));
    },
    getItem(key) {
        return Promise.resolve(storageMapInternal[key]);
    },
    multiGet(keys) {
        const getPromises = _.map(keys, key => new Promise(resolve => this.getItem(key).then(value => resolve([key, value]))));
        return Promise.all(getPromises);
    },
    multiMerge(pairs) {
        const mergePromises = _.map(pairs, ([key, value]) => setItemQueue.push({key, value, shouldMerge: true}));
        return new Promise(resolve => Promise.all(mergePromises).then(() => resolve(storageMapInternal)));
    },
    removeItem(key) {
        delete storageMapInternal[key];
        return Promise.resolve();
    },
    removeItems(keys) {
        _.each(keys, (key) => {
            delete storageMapInternal[key];
        });
        return Promise.resolve();
    },
    clear() {
        setItemQueue.abort();
        storageMapInternal = {};
        return Promise.resolve();
    },
    getAllKeys() {
        return Promise.resolve(_.keys(storageMapInternal));
    },
    config() {},
};

const localForageMockSpy = {
    localForageSet: set,
    setItem: jest.fn(localForageMock.setItem),
    getItem: jest.fn(localForageMock.getItem),
    removeItem: jest.fn(localForageMock.removeItem),
    removeItems: jest.fn(localForageMock.removeItems),
    clear: jest.fn(localForageMock.clear),
    getAllKeys: jest.fn(localForageMock.getAllKeys),
    config: jest.fn(localForageMock.config),
    multiGet: jest.fn(localForageMock.multiGet),
    multiSet: jest.fn(localForageMock.multiSet),
    multiMerge: jest.fn(localForageMock.multiMerge),

    getStorageMap: jest.fn(() => storageMapInternal),
    setInitialMockData: jest.fn((data) => {
        storageMapInternal = data;
    }),
};

export default localForageMockSpy;
