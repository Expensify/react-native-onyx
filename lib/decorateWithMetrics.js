import _ from 'underscore';

/**
 * Each key is a method name and the value is an array of calls metadata
 * @type {Record<String, Array<CallMeta>>}
 */
let stats = {};

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

        const originalPromise = func.apply(this, args);

        /*
        * Then handlers added here are not affecting the original promise
        * They crate a separate chain that's not exposed (returned) to the original caller
        * */
        originalPromise
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
                });
            });

        return originalPromise;
    }

    return decorated;
}

/**
 * Returns a list of calls metadata
 *
 * @returns {Array<CallMeta>}
 */
function getMetrics() {
    return _.chain(stats)
        .values()
        .flatten()
        .value();
}

/**
 * Clears all collected metrics.
 */
function resetMetrics() {
    stats = {};
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
