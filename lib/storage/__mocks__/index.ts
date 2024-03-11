import type {OnyxKey, OnyxValue} from '../../types';
import utils from '../../utils';
import type {KeyValuePairList} from '../providers/types';
import type StorageProvider from '../providers/types';

let storageMapInternal: Record<OnyxKey, OnyxValue> = {};

const set = jest.fn((key, value) => {
    storageMapInternal[key] = value;
    return Promise.resolve(value);
});

const idbKeyvalMock: StorageProvider = {
    setItem(key, value) {
        return set(key, value);
    },
    multiSet(pairs) {
        const setPromises = pairs.map(([key, value]) => this.setItem(key, value));
        return new Promise((resolve) => {
            Promise.all(setPromises).then(() => resolve(storageMapInternal));
        });
    },
    getItem(key) {
        return Promise.resolve(storageMapInternal[key]);
    },
    multiGet(keys) {
        const getPromises = keys.map(
            (key) =>
                new Promise((resolve) => {
                    this.getItem(key).then((value) => resolve([key, value]));
                }),
        );
        return Promise.all(getPromises) as Promise<KeyValuePairList>;
    },
    multiMerge(pairs) {
        pairs.forEach(([key, value]) => {
            const existingValue = storageMapInternal[key];
            const newValue = utils.fastMerge(existingValue!, value!);

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
        keys.forEach((key) => {
            delete storageMapInternal[key];
        });
        return Promise.resolve();
    },
    clear() {
        storageMapInternal = {};
        return Promise.resolve();
    },
    getAllKeys() {
        return Promise.resolve(Object.keys(storageMapInternal));
    },
    getDatabaseSize() {
        return Promise.resolve({bytesRemaining: 0, bytesUsed: 99999});
    },
};

const idbKeyvalMockSpy = {
    idbKeyvalSet: set,
    setItem: jest.fn(idbKeyvalMock.setItem),
    getItem: jest.fn(idbKeyvalMock.getItem),
    removeItem: jest.fn(idbKeyvalMock.removeItem),
    removeItems: jest.fn(idbKeyvalMock.removeItems),
    clear: jest.fn(idbKeyvalMock.clear),
    getAllKeys: jest.fn(idbKeyvalMock.getAllKeys),
    multiGet: jest.fn(idbKeyvalMock.multiGet),
    multiSet: jest.fn(idbKeyvalMock.multiSet),
    multiMerge: jest.fn(idbKeyvalMock.multiMerge),
    mergeItem: jest.fn(idbKeyvalMock.mergeItem),
    getStorageMap: jest.fn(() => storageMapInternal),
    setInitialMockData: jest.fn((data) => {
        storageMapInternal = data;
    }),
    getDatabaseSize: jest.fn(idbKeyvalMock.getDatabaseSize),
};

export default idbKeyvalMockSpy;
