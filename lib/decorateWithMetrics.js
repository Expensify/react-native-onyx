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
 * Calculate the total sum of a given key in a list
 * @param {Array<Record<prop, Number>>} list
 * @param {string} prop
 * @returns {number}
 */
function sum(list, prop) {
    return _.reduce(list, (memo, next) => memo + next[prop], 0);
}

/**
 * Round a number to a specific decimal precision
 * @param {number} value
 * @param {number} [precision]
 * @returns {number}
 */
function roundToPrecision(value, precision = 3) {
    const multiplier = 10 ** precision;
    return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

/**
 * Returns all captured stats and a print method that can print them to the dev console
 * @returns {{print: function, averageTime: number, stats: CallMeta, totalTime: number}}
 */
function getMetrics() {
    const currentStats = _.chain(stats)
        .values()
        .flatten()
        .map(call => ({
            ...call,
            startTime: roundToPrecision(call.startTime),
            endTime: roundToPrecision(call.endTime),
            duration: roundToPrecision(call.startTime + call.endTime),
        }))
        .value();

    const totalTime = roundToPrecision(sum(currentStats, 'duration'));
    const averageTime = roundToPrecision(totalTime / currentStats.length) || 0;

    return {
        totalTime,
        averageTime,
        stats: currentStats,
        print() {
            /* eslint-disable no-console */
            console.groupCollapsed('Onyx Benchmark');
            console.info('Total Time (ms): ', this.totalTime);
            console.info('Average Time (ms): ', this.averageTime);
            console.table(this.stats);
            console.groupEnd();
            /* eslint-enable */
        }
    };
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
 * @property {Number} [duration] - the it took to resolve this async call
 * @property {Array<any>} args - arguments passed to the call
 */

export {
    decorateWithMetrics,
    getMetrics,
    resetMetrics,
};
