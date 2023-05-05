import _ from 'underscore';
import fastMerge from '../../fastMerge';

let storageMapInternal = {};

const set = jest.fn((key, value) => {
    // eslint-disable-next-line no-param-reassign
    storageMapInternal[key] = value;
    return Promise.resolve(storageMapInternal[key]);
});

const localForageMock = {
    setItem(key, value) {
        set(key, value);
        return Promise.resolve();
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
        _.forEach(pairs, ([key, value]) => {
            const existingValue = storageMapInternal[key];
            const newValue = _.isObject(existingValue)
                ? fastMerge(existingValue, value) : value;

            set(key, newValue);
        });

        return Promise.resolve(storageMapInternal);
    },
    mergeItem(key, _changes, modifiedData) {
        return this.setItem(key, modifiedData);
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
    mergeItem: jest.fn(localForageMock.mergeItem),
    getStorageMap: jest.fn(() => storageMapInternal),
    setInitialMockData: jest.fn((data) => {
        storageMapInternal = data;
    }),
};

export default localForageMockSpy;
