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
 * Decorates an instance method with metrics capturing functionality
 * The method needs to be async or to return a promise
 * @param {Object} instance
 * @param {String} methodName
 */
function decorateWithMetrics(instance, methodName) {
    const originalMethod = instance[methodName];

    if (!stats.has(methodName)) {
        stats.set(methodName, []);
    }

    // eslint-disable-next-line no-param-reassign
    instance[methodName] = (...args) => {
        const startTime = performance.now();
        let result;
        let error;

        const promise = originalMethod.apply(instance, args);

        // Then handlers added here are not affecting the returned promise as they aren't attached to it
        promise.then(data => data && (result = new TaggedItem(data)))
            .catch(err => (error = err))
            .finally(() => {
                const endTime = performance.now();

                const methodStats = stats.get(methodName);
                methodStats.push({
                    startTime,
                    endTime,
                    args,
                    result: result && result.ref,
                    error,
                });
            });

        return promise;
    };
}

/**
 * Returns a list of calls metadata for the given method
 * The list would be empty if nothing is captured yet or the method is not metered
 * @param {String} methodName
 * @returns {Array<CallMeta>}
 */
function getMetrics(methodName) {
    const metrics = stats.get(methodName) || [];
    return metrics;
}

/**
 * Clears metrics.
 * By default clears all collected metrics, pass a methodName to only clear the metrics
 * for the given method
 * @param {String} [methodName]
 */
function restetMetrics(methodName) {
    if (methodName) {
        stats.delete(methodName);
    } else {
        stats.clear();
    }
}

/**
 * @typedef {Object} CallMeta
 * @property {Number} startTime
 * @property {Number} endTime
 * @property {Array<any>} args - arguments passed to the call
 * @property {TaggedItem} result - result of the call
 * @property {Error} error - any captured errors
 */

export {
    decorateWithMetrics,
    getMetrics,
    restetMetrics,
    stats,
};
