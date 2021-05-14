import _ from 'underscore';

/**
 * Each key is a method name and the value is an array of calls metadata
 * @type {Map<String, Array<CallMeta>>}
 */
const stats = new Map();

/**
 * Class instances are easily tracked by Dev tools memory snapshots
 * Wrapping a result with such instance allows us to track it without
 * incurring extra weight
 */
class TaggedItem {
    constructor(data) {
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
 * Decorates an instance method with metrics capturing functionality
 * @param {Object} instance
 * @param {String} methodName
 */
function decorateWithMetrics(instance, methodName) {
    const originalMethod = instance[methodName];

    if (stats.has(methodName)) {
        throw new Error(`"${methodName}" is already decorated`);
    }

    stats.set(methodName, []);

    // eslint-disable-next-line no-param-reassign
    instance[methodName] = (...args) => {
        const startTime = performance.now();
        let result;
        let error;

        const originalReturnValue = originalMethod.apply(instance, args);

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
            .catch(err => (error = err))
            .finally(() => {
                const endTime = performance.now();

                if (!stats.has(methodName)) {
                    stats.set(methodName, []);
                }

                const methodStats = stats.get(methodName);
                methodStats.push({
                    methodName,
                    startTime,
                    endTime,
                    args,
                    result,
                    error,
                });
            });

        return originalReturnValue;
    };
}

/**
 * Decorate multiple instance methods with metrics capturing functionality
 * @param {Object} instance
 * @param {String[]} methodNames
 */
function decorateWithMetricsMultiple(instance, methodNames) {
    methodNames.forEach(name => decorateWithMetrics(instance, name));
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
        return stats.get(methodName) || [];
    }

    return Array.from(stats.values()).flat();
}

/**
 * Clears metrics.
 * By default clears all collected metrics, pass a methodName to only clear the metrics
 * for the given method
 * @param {String} [methodName]
 */
function resetMetrics(methodName) {
    if (methodName) {
        stats.delete(methodName);
    } else {
        stats.clear();
    }
}

/**
 * @typedef {Object} CallMeta
 * @property {String} methodName
 * @property {Number} startTime - start time in ms relative to app startup - 0.00 is exactly at start
 * @property {Number} endTime - end time in ms relative to app startup - 0.00 is exactly at start
 * @property {Array<any>} args - arguments passed to the call
 * @property {TaggedItem} result - result of the call
 * @property {Error} error - any captured errors
 */

export {
    decorateWithMetrics,
    decorateWithMetricsMultiple,
    getMetrics,
    resetMetrics,
    stats,
};
