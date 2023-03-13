import Storage from './storage';

function merge(key, _changes, modifiedData) {
    return Storage.set(key, modifiedData);
}

export default {merge};
