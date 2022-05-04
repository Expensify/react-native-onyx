import _ from 'underscore';

let storageMap = {};
let clearDelay = null;

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
        console.log("localforage mock clear");
        return new Promise((resolve) => {
            if (clearDelay) {
                setTimeout(() => {
                    storageMap = {};
                    resolve();
                }, clearDelay);
            } else {
                storageMap = {};
                resolve();
            }
        });
    },

    setDelayForClear(delay) {
        clearDelay = delay;
    }
};

export default localforageMock;
