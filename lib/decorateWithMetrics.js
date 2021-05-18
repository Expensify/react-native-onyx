import _ from 'underscore';

/**
 * Each key is a method name and the value is an array of calls metadata
 * @type {Record<String, Array<CallMeta>>}
 */
let stats = {};

/**
 * A class instance is easily tracked in dev tools
 * Wrapping results from decorated methods with this allows us to easily trace
 * their memory usage in dev tools
 */
class TaggedItem {
    constructor(data) {
        Object.assign(this, data);
        this.ref = data;
    }
}

/**
 * Capture tags in a weak map
 * When the original object (key) is no longer used anywhere in app - the data (TaggedItem)
 * is free for garbage collection and removed
 * Using dev tools we see which TaggedItems are still retained and what's using them - preventing GC
 * @type {WeakMap<object, TaggedItem>}
 */
const taggedItems = new WeakMap();

/**
 * Wraps a function with metrics capturing logic
 * @param {function} func
 * @param {String} [alias]
 * @returns {function} The wrapped function
 */
function decorateWithMetrics(func, alias = func.name) {
    if (_.has(stats, alias)) {
        throw new Error(`"${alias}" is already decorated`);
    }

    stats[alias] = [];

    function decorated(...args) {
        const startTime = performance.now();
        let result;

        const originalReturnValue = func.apply(this, args);

        /*
        * Promisify the original return value in case the decorated method does not return a promise
        * Then handlers added here are not affecting the returned promise as they aren't attached to it
        * */
        Promise.resolve(originalReturnValue)
            .then((data) => {
                result = data;

                // Weak map keys can be objects only
                if (_.isObject(data)) {
                    const tag = new TaggedItem(data);
                    taggedItems.set(data, tag);
                }
            })
            .catch(error => (result = error))
            .finally(() => {
                const endTime = performance.now();

                if (!_.has(stats, alias)) {
                    stats[alias] = [];
                }

                const methodStats = stats[alias];
                methodStats.push({
                    methodName: alias,
                    startTime,
                    endTime,
                    args,
                    result,
                });
            });

        return originalReturnValue;
    }

    return decorated;
}

/**
 * Returns a list of calls metadata
 * By default returns a list of calls for all methods, pass a methodName to get calls for it only
 * The list would be empty if nothing is captured yet or the method is not metered
 * @param {String} [methodName]
 * @returns {Array<CallMeta>}
 */
function getMetrics(methodName) {
    if (methodName) {
        return stats[methodName] || [];
    }

    return _.chain(stats)
        .values()
        .flatten()
        .value();
}

/**
 * Clears metrics.
 * By default clears all collected metrics, pass a methodName to only clear the metrics
 * for the given method
 * @param {String} [methodName]
 */
function resetMetrics(methodName) {
    if (methodName) {
        delete stats[methodName];
    } else {
        stats = {};
    }
}

/**
 * @typedef {Object} CallMeta
 * @property {String} methodName
 * @property {Number} startTime - start time in ms relative to app startup - 0.00 is exactly at start
 * @property {Number} endTime - end time in ms relative to app startup - 0.00 is exactly at start
 * @property {Array<any>} args - arguments passed to the call
 * @property {any} result - result of the call (return value or error)
 */

export {
    decorateWithMetrics,
    getMetrics,
    resetMetrics,
};
