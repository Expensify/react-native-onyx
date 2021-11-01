/**
 * @file
 * The storage provider based on localforage allows us to store most anything in its
 * natural form in the underlying DB without having to stringify or de-stringify it
 */

import localforage from 'localforage';
import _ from 'underscore';
import lodashMerge from 'lodash/merge';

localforage.config({
    name: 'OnyxDB'
});

const provider = {
    multiGet(keys) {
        const pairs = _.map(
            keys,
            key => localforage.getItem(key)
                .then(value => [key, value])
        );

        return Promise.all(pairs);
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

        // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
        return Promise.all(tasks).then(() => Promise.resolve());
    },
    multiSet(pairs) {
        // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
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
