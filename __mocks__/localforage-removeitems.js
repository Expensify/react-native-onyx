import _ from 'underscore';

function extendPrototype(localforage) {
    const newLocalforage = localforage;
    newLocalforage.removeItems = keys => new Promise((resolve) => {
        _.each(keys, (key) => {
            delete newLocalforage.storageMap[key];
        });
        resolve();
    });
}

// eslint-disable-next-line import/prefer-default-export
export {extendPrototype};
