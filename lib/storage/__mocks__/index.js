import _ from 'underscore';
import fastMerge from '../../fastMerge';

let storageMap = {};

const mergeValue = (key, value) => {
    const existingValue = storageMap[key];
    const newValue = _.isObject(existingValue)

        // lodash adds a small overhead so we don't use it here
        // eslint-disable-next-line prefer-object-spread, rulesdir/prefer-underscore-method
        ? Object.assign({}, fastMerge(existingValue, value))
        : value;
    return newValue;
};

const localforageMock = {
    get storageMap() {
        return storageMap;
    },
    multiGet: jest.fn(keys => new Promise(resolve => resolve(_.get(storageMap, keys)))),
    multiMerge: jest.fn(pairs => new Promise((resolve) => {
        _.forEach(pairs, ([key, value]) => storageMap[key] = mergeValue(key, value));
        resolve(storageMap);
    })),
    multiSet: jest.fn(pairs => new Promise((resolve) => {
        _.forEach(pairs, ([key, value]) => storageMap[key] = value);
        resolve(storageMap);
    })),
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
