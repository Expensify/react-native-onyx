import _ from 'underscore';
import fastMerge from '../../fastMerge';
import SyncQueue from '../../SyncQueue';

function set(storageMap, key, value) {
    // eslint-disable-next-line no-param-reassign
    storageMap[key] = value;
    return Promise.resolve(storageMap[key]);
}

const localForageMock = {
    storageMap: {},
    setItemQueue: new SyncQueue(({key, value, shouldMerge}) => {
        if (shouldMerge) {
            const existingValue = this.storageMap[key];
            const newValue = _.isObject(existingValue)
                ? fastMerge(existingValue, value)
                : value;
            return set(this.storageMap, key, newValue);
        }

        return set(this.storageMap, key, value);
    }),
    localForageSet() { return set(this.storageMap); },
    setItem(key, value) {
        return this.setItemQueue.push({key, value});
    },
    multiSet(pairs) {
        const setPromises = _.map(pairs, ([key, value]) => this.setItem(key, value));
        return new Promise(resolve => Promise.all(setPromises).then(() => resolve(this.storageMap)));
    },
    getItem(key) {
        return Promise.resolve(this.storageMap[key]);
    },
    multiGet(keys) {
        const getPromises = _.map(keys, key => new Promise(resolve => this.getItem(key).then(value => resolve([key, value]))));
        return Promise.all(getPromises);
    },
    multiMerge(pairs) {
        const mergePromises = _.map(pairs, ([key, value]) => this.setItemQueue.push({key, value, shouldMerge: true}));
        return new Promise(resolve => Promise.all(mergePromises).then(() => resolve(this.storageMap)));
    },
    removeItem(key) {
        delete this.storageMap[key];
        return Promise.resolve();
    },
    removeItems(keys) {
        _.each(keys, (key) => {
            delete this.storageMap[key];
        });
        return Promise.resolve();
    },
    clear() {
        this.setItemQueue.abort();
        this.storageMap = {};
        return Promise.resolve();
    },
    getAllKeys() {
        return Promise.resolve(_.keys(this.storageMap));
    },
    setInitialMockData(data) {
        this.storageMap = data;
    },
    config() {},
};

const localForageMockSpy = {
    storageMap: localForageMock.storageMap,
    setItemQueue: localForageMock.setItemQueue,
    localForageSet: jest.fn(localForageMock.localForageSet),
    setItem: jest.fn(localForageMock.setItem),
    getItem: jest.fn(localForageMock.getItem),
    removeItem: jest.fn(localForageMock.removeItem),
    removeItems: jest.fn(localForageMock.removeItems),
    clear: jest.fn(localForageMock.clear),
    getAllKeys: jest.fn(localForageMock.getAllKeys),
    setInitialMockData: jest.fn(localForageMock.setInitialMockData),
    config: jest.fn(localForageMock.config),
    multiGet: jest.fn(localForageMock.multiGet),
    multiSet: jest.fn(localForageMock.multiSet),
    multiMerge: jest.fn(localForageMock.multiMerge),
};

export default localForageMockSpy;
