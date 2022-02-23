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

class SynchronousWriteQueue {
    constructor() {
        this.isWriting = false;
        this.queue = [];
    }

    push(item) {
        this.queue.push(item);
        this.process();
    }

    process() {
        if (this.isWriting) {
            return;
        }

        this.isWriting = true;
        const next = this.queue.shift();
        if (!next) {
            this.isWriting = false;
            return;
        }

        const {
            key, value, resolve, reject,
        } = next;
        localforage.setItem(key, value)
            .then(resolve)
            .catch(reject)
            .finally(() => {
                this.isWriting = false;
                this.process();
            });
    }
}

const pairQueue = new SynchronousWriteQueue();
const provider = {
    /**
     * Get multiple key-value pairs for the give array of keys in a batch
     * @param {String[]} keys
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet(keys) {
        const pairs = _.map(
            keys,
            key => localforage.getItem(key)
                .then(value => [key, value])
        );

        return Promise.all(pairs);
    },

    /**
     * Multiple merging of existing and new values in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiMerge(pairs) {
        const tasks = _.map(pairs, ([key, partialValue]) => this.getItem(key)
            .then((existingValue) => {
                const newValue = _.isObject(existingValue)
                    ? lodashMerge(existingValue, partialValue)
                    : partialValue;

                return this.setItem(key, newValue);
            }));

        // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
        return Promise.all(tasks).then(() => Promise.resolve());
    },

    /**
     * Stores multiple key-value pairs in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet(pairs) {
        // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
        const tasks = _.map(pairs, ([key, value]) => this.setItem(key, value));
        return Promise.all(tasks).then(() => Promise.resolve());
    },

    /**
     * Clear absolutely everything from storage
     * @returns {Promise<void>}
     */
    clear: localforage.clear,

    /**
     * Returns all keys available in storage
     * @returns {Promise<String[]>}
     */
    getAllKeys: localforage.keys,

    /**
     * Get the value of a given key or return `null` if it's not available in storage
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem: localforage.getItem,

    /**
     * Remove given key and it's value from storage
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem: localforage.removeItem,

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem: (key, value) => new Promise((resolve, reject) => {
        pairQueue.push({
            key, value, resolve, reject,
        });
    }),
};

export default provider;
