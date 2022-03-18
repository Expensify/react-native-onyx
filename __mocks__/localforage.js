import _ from 'underscore';

let storageMap = {};

const localforageMock = {
    get storageMap() {
        return storageMap;
    },
    keys() {
        return new Promise((resolve) => {
            resolve(_.keys(storageMap));
        });
    },
    setInitialMockData: (data) => {
        storageMap = data;
    },
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
    clear() {
        return new Promise((resolve) => {
            storageMap = {};
            resolve();
        });
    },
};

export default localforageMock;
