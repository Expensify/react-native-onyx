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
 * Returns total, average time and all captured stats mapped under
 * summaries.methodName -> StatSummary
 * @returns {{averageTime: number, summaries: Record<string, StatSummary>, totalTime: number}}
 */
function getMetrics() {
    const summaries = _.chain(stats)
        .map((calls, methodName) => {
            const totalTime = sum(calls, 'duration');
            const averageTime = totalTime / calls.length;
            const maxTime = _.max(calls, 'duration').duration;
            const minTime = _.min(calls, 'duration').duration;

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

    const totalTime = sum(_.values(summaries), 'totalTime');
    const averageTime = totalTime / summaries.length || 0;

    return {
        totalTime,
        averageTime,
        summaries,
    };
}

function toHumanReadableDuration(millis) {
    const minute = 60 * 60 * 1000;
    if (millis > minute) {
        return `${(millis / minute).toFixed(1)}min`;
    }

    const second = 60 * 1000;
    if (millis > second) {
        return `${(millis / second).toFixed(2)}sec`;
    }

    return `${millis.toFixed(3)}ms`;
}

/**
 * Print extensive information on the dev console
 * max, min, average, total time for each method
 * and a table of individual calls
 */
function printMetrics() {
    const {totalTime, averageTime, summaries} = getMetrics();

    /* eslint-disable no-console */
    console.group('Onyx Benchmark');
    console.info('Total: ', toHumanReadableDuration(totalTime));
    console.info('Average: ', toHumanReadableDuration(averageTime));
    console.info('------');

    _.forEach(summaries, ({calls, ...summary}) => {
        console.info(summary.methodName);
        console.info('Total: ', toHumanReadableDuration(summary.totalTime));
        console.info('Average: ', toHumanReadableDuration(summary.averageTime));
        console.info('Min: ', toHumanReadableDuration(summary.minTime));
        console.info('Max: ', toHumanReadableDuration(summary.maxTime));
        console.table(calls.map(call => ({
            startTime: toHumanReadableDuration(call.startTime),
            endTime: toHumanReadableDuration(call.endTime),
            duration: toHumanReadableDuration(call.endTime - call.startTime),
            args: JSON.stringify(call.args)
        })));
        console.info('------');
    });
    console.groupEnd();
    /* eslint-enable */
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
    printMetrics,
};
