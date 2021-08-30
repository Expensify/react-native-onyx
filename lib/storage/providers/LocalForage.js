/**
 * @file
 * The storage provider based on localforage allows us to store most anything in its
 * natural form in the underlying DB without having to stringify or de-stringify it
 */

import localforage from 'localforage';
import _ from 'underscore';
import lodashMerge from 'lodash/merge';

localforage.config({
    name: 'OnyxDb'
});

const provider = {
    multiGet(keys) {
        const pairs = [];
        const remainingKeys = new Set(keys);

        return localforage.iterate((value, key) => {
            if (remainingKeys.has(key)) {
                remainingKeys.delete(key);
                pairs.push([key, value]);
            }

            // Exist early (don't iterate all keys) if we've mapped everything
            if (remainingKeys.size === 0) {
                return true;
            }

            return undefined;
        })
            .then(() => pairs);
    },
    multiMerge(pairs) {
        const tasks = pairs.map(([key, delta]) => this.getItem(key)
            .then((existing) => {
                let merged = delta;

                if (existing) {
                    if (_.isObject(existing)) {
                        merged = lodashMerge(existing, delta);
                    }
                }

                return this.setItem(key, merged);
            }));

        return Promise.all(tasks).then(() => Promise.resolve());
    },
    multiSet(pairs) {
        const tasks = pairs.map(([key, value]) => this.setItem(key, value));
        return Promise.all(tasks).then(() => Promise.resolve());
    },

    clear: localforage.clear,
    getAllKeys: localforage.keys,
    getItem: localforage.getItem,
    removeItem: localforage.removeItem,
    setItem: localforage.setItem,
};

export default provider;
