import Storage from './storage';

function merge(key, _changes, modifiedData) {
    return Storage.setItem(key, modifiedData);
}

export default {merge};
