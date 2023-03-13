import Storage from './storage';

function merge(key, changes) {
    return Storage.mergeItem(key, changes);
}

export default {merge};
