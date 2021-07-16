import _ from 'underscore';

/**
 * Each key is a method name and the value is an array of calls metadata
 * @type {Record<String, Array<Object>>}
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
        * They create a separate chain that's not exposed (returned) to the original caller
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
 * Aggregates and returns benchmark information
 * @returns {{summaries: Record<string, Object>, totalTime: number, lastCompleteCall: *}}
 * An object with
 * - `totalTime` - total time spent by decorated methods
 * - `lastCompleteCall` - millisecond since launch the last call completed at
 * - `summaries` - mapping of all captured stats: summaries.methodName -> method stats
 */
function getMetrics() {
    const summaries = _.chain(stats)
        .map((data, methodName) => {
            const calls = _.map(data, call => ({...call, duration: call.endTime - call.startTime}));
            const total = sum(calls, 'duration');
            const avg = (total / calls.length) || 0;
            const max = _.max(calls, 'duration').duration || 0;
            const min = _.min(calls, 'duration').duration || 0;
            const lastCall = _.max(calls, 'endTime');

            return [methodName, {
                methodName,
                total,
                max,
                min,
                avg,
                lastCall,
                calls,
            }];
        })
        .object() // Create a map like methodName -> StatSummary
        .value();

    const totalTime = sum(_.values(summaries), 'total');
    const lastCompleteCall = _.max(_.values(summaries), ['lastCall', 'endTime']).lastCall;

    return {
        totalTime,
        summaries,
        lastCompleteCall,
    };
}

/**
 * Convert milliseconds to human readable time
 * @param {number} millis
 * @param {boolean} [raw=false]
 * @returns {string|number}
 */
function toDuration(millis, raw = false) {
    if (raw) {
        return millis;
    }

    const minute = 60 * 1000;
    if (millis > minute) {
        return `${(millis / minute).toFixed(1)}min`;
    }

    const second = 1000;
    if (millis > second) {
        return `${(millis / second).toFixed(2)}sec`;
    }

    return `${millis.toFixed(3)}ms`;
}

/**
 * Print extensive information on the dev console
 * max, min, average, total time for each method
 * and a table of individual calls
 *
 * @param {boolean} [raw=false] setting this to true will print raw instead of human friendly times
 * Useful when you copy the printed table to excel and let excel do the number formatting
 */
function printMetrics(raw = false) {
    const {totalTime, summaries, lastCompleteCall = {endTime: -1}} = getMetrics();

    const prettyData = _.chain(summaries)
        .filter(method => method.avg > 0)
        .sortBy('avg')
        .reverse()
        .map(({
            calls, methodName, lastCall, ...summary
        }) => {
            const prettyTimes = _.chain(summary)
                .map((value, key) => ([key, toDuration(value, raw)]))
                .object()
                .value();

            const prettyCalls = calls.map(call => ({
                startTime: toDuration(call.startTime, raw),
                endTime: toDuration(call.endTime, raw),
                duration: toDuration(call.duration, raw),
                args: JSON.stringify(call.args)
            }));

            return {
                methodName,
                ...prettyTimes,
                'time last call completed': toDuration(lastCall.endTime, raw),
                calls: calls.length,
                prettyCalls,
            };
        })
        .value();

    /* eslint-disable no-console */
    console.group('Onyx Benchmark');
    console.info('  Total: ', toDuration(totalTime, raw));
    console.info('  Last call finished at: ', toDuration(lastCompleteCall.endTime, raw));

    console.table(prettyData.map(({prettyCalls, ...summary}) => summary));

    prettyData.forEach((method) => {
        console.groupCollapsed(`[${method.methodName}] individual calls: `);
        console.table(method.prettyCalls);
        console.groupEnd();
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

export {
    decorateWithMetrics,
    getMetrics,
    resetMetrics,
    printMetrics,
};
