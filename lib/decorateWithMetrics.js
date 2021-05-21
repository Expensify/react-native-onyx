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
 * @returns {{print: function, averageTime: number, summaries: Record<string, StatSummary>, totalTime: number}}
 */
function getMetrics() {
    const summaries = _.chain(stats)
        .map((data, methodName) => {
            const calls = data.map(call => ({
                ...call,
                startTime: roundToPrecision(call.startTime),
                endTime: roundToPrecision(call.endTime),
                duration: roundToPrecision(call.startTime + call.endTime),
            }));

            const totalTime = roundToPrecision(sum(calls, 'duration'));
            const averageTime = roundToPrecision(totalTime / calls.length) || 0;
            const maxTime = roundToPrecision(_.max(calls, 'duration').duration);
            const minTime = roundToPrecision(_.min(calls, 'duration').duration);

            return [methodName, {
                methodName,
                totalTime,
                averageTime,
                maxTime,
                minTime,
                calls,
            }];
        })
        .object() // Create a map like methodName -> StatSummary
        .value();

    const totalTime = roundToPrecision(sum(_.values(summaries), 'totalTime'));
    const averageTime = roundToPrecision(totalTime / summaries.length) || 0;

    return {
        /**
         * Print extensive information on the dev console
         * max, min, average, total time for each method
         * and a table of individual calls
         */
        print() {
            /* eslint-disable no-console */
            console.groupCollapsed('Onyx Benchmark');
            console.info('Total Time (ms): ', this.totalTime);
            console.info('Average Time (ms): ', this.averageTime);

            _.forEach(this.summaries, (summary) => {
                console.info(summary.methodName);
                console.info('Total Time (ms): ', summary.totalTime);
                console.info('Average Time (ms): ', summary.averageTime);
                console.info('Min Time (ms): ', summary.minTime);
                console.info('Max Time (ms): ', summary.maxTime);
                console.table(summary.calls);
            });
            console.groupEnd();
            /* eslint-enable */
        },
        totalTime,
        averageTime,
        summaries,
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
 * @property {string} methodName
 * @property {number} startTime - start time in ms relative to app startup - 0.00 is exactly at start
 * @property {number} endTime - end time in ms relative to app startup - 0.00 is exactly at start
 * @property {number} [duration] - the it took to resolve this async call
 * @property {Array<any>} args - arguments passed to the call
 */

/**
 * @typedef {Object} StatSummary
 * @property {string} methodName
 * @property {number} minTime - the quickest execution for this method
 * @property {number} maxTime - the longest execution for this method
 * @property {number} averageTime - average execution time for the method
 * @property {number} totalTime - sum of the duration for all the calls
 * @property {Array<CallMeta>} calls - a collection of all the calls for this method
 */

export {
    decorateWithMetrics,
    getMetrics,
    resetMetrics,
};
