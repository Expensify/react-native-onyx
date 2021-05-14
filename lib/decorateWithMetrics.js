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
 * @param {String} [alias]
 */
function decorateWithMetrics(instance, methodName, alias = methodName) {
    const originalMethod = instance[methodName];

    if (stats.has(alias)) {
        throw new Error(`"${alias}" is already decorated`);
    }

    stats.set(alias, []);

    // eslint-disable-next-line no-param-reassign
    instance[methodName] = (...args) => {
        const startTime = performance.now();
        let result;

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
            .catch(error => (result = error))
            .finally(() => {
                const endTime = performance.now();

                if (!stats.has(alias)) {
                    stats.set(alias, []);
                }

                const methodStats = stats.get(alias);
                methodStats.push({
                    methodName: alias,
                    startTime,
                    endTime,
                    args,
                    result,
                });
            });

        return originalReturnValue;
    };
}

/**
 * Decorate multiple instance methods with metrics capturing functionality
 * @param {Object} instance
 * @param {String[]} methodNames
 * @param {String} [prefix] - Optionally prefix method names with this
 */
function decorateWithMetricsMultiple(instance, methodNames, prefix = '') {
    methodNames.forEach(name => decorateWithMetrics(instance, name, `${prefix}${name}`));
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
 * @property {any} result - result of the call (return value or error)
 */

export {
    decorateWithMetrics,
    decorateWithMetricsMultiple,
    getMetrics,
    resetMetrics,
    stats,
};
