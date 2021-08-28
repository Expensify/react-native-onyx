/**
 * @file
 * The storage provider based on localforage allows us to store most anything in its
 * natural form in the underlying DB without having to stringify or de-stringify it
 */

import localforage from 'localforage';
import _ from 'underscore';
import lodashMerge from 'lodash/merge';

class Storage {
    constructor() {
        /** @type {import('localforage').LocalForageDbMethods} */
        this.store = localforage.createInstance({
            name: 'OnyxDb'
        });
    }

    clear() {
        return this.store.clear();
    }

    getAllKeys() {
        return this.store.keys();
    }

    getItem(key) {
        return this.store.getItem(key);
    }

    multiGet(keys) {
        const pairs = [];
        const remainingKeys = new Set(keys);

        return this.store.iterate((value, key) => {
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
    }

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
    }

    multiSet(pairs) {
        const tasks = pairs.map(([key, value]) => this.setItem(key, value));
        return Promise.all(tasks).then(() => Promise.resolve());
    }

    removeItem(key) {
        return this.store.removeItem(key);
    }

    setItem(key, value) {
        return this.store.setItem(key, value).then(() => Promise.resolve());
    }
}

export default Storage;
