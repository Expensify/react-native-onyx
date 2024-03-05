"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = __importDefault(require("../../utils"));
let storageMapInternal = {};
const set = jest.fn((key, value) => {
    storageMapInternal[key] = value;
    return Promise.resolve(value);
});
const idbKeyvalMock = {
    setItem(key, value) {
        return set(key, value);
    },
    multiSet(pairs) {
        const setPromises = pairs.map(([key, value]) => this.setItem(key, value));
        return new Promise((resolve) => Promise.all(setPromises).then(() => resolve(storageMapInternal)));
    },
    getItem(key) {
        return Promise.resolve(storageMapInternal[key]);
    },
    multiGet(keys) {
        const getPromises = keys.map((key) => new Promise((resolve) => this.getItem(key).then((value) => resolve([key, value]))));
        return Promise.all(getPromises);
    },
    multiMerge(pairs) {
        pairs.forEach(([key, value]) => {
            const existingValue = storageMapInternal[key];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newValue = utils_1.default.fastMerge(existingValue, value);
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
        return Promise.resolve({ bytesRemaining: 0, bytesUsed: 99999 });
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setMemoryOnlyKeys() { },
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
    setMemoryOnlyKeys: jest.fn(idbKeyvalMock.setMemoryOnlyKeys),
};
exports.default = idbKeyvalMockSpy;
