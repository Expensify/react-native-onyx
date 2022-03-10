import _ from 'underscore';

let storageMap = {};
const DELAY_MS = 5000;

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
    getItem(key) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(storageMap[key]);
            }, DELAY_MS);
        });
    },
    setItem: jest.fn((key, value) => new Promise((resolve) => {
        setTimeout(() => {
            storageMap[key] = value;
            resolve();
        }, DELAY_MS);
    })),
    removeItem: jest.fn(key => new Promise((resolve) => {
        setTimeout(() => {
            delete storageMap[key];
            resolve();
        }, DELAY_MS);
    })),
};

export default localforageMock;
