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
 * Returns total, average time and all captured stats mapped under
 * summaries.methodName -> method stats
 * @returns {{averageTime: number, summaries: Record<string, Object>, totalTime: number}}
 */
function getMetrics() {
    const summaries = _.chain(stats)
        .map((data, methodName) => {
            const calls = _.map(data, call => ({...call, duration: call.endTime - call.startTime}));
            const total = sum(calls, 'duration');
            const avg = (total / calls.length) || 0;
            const max = _.max(calls, 'duration').duration || 0;
            const min = _.min(calls, 'duration').duration || 0;

            return [methodName, {
                methodName,
                total,
                max,
                min,
                avg,
                calls,
            }];
        })
        .object() // Create a map like methodName -> StatSummary
        .value();

    const totalTime = sum(_.values(summaries), 'total');
    const averageTime = (totalTime / _.size(summaries)) || 0;

    return {
        totalTime,
        averageTime,
        summaries,
    };
}

function toHumanReadableDuration(millis) {
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
 */
function printMetrics() {
    const {totalTime, averageTime, summaries} = getMetrics();

    /* eslint-disable no-console */
    console.group('Onyx Benchmark');
    console.info('  Total: ', toHumanReadableDuration(totalTime));
    console.info('  Average: ', toHumanReadableDuration(averageTime));

    _.chain(summaries)
        .sortBy('avg')
        .reverse()
        .forEach(({calls, methodName, ...summary}) => {
            const times = _.map(summary, (value, key) => `${key}: ${toHumanReadableDuration(value)}`);

            console.groupCollapsed(`${methodName}\n  ${times.join('\n  ')} \n  calls: ${calls.length}`);
            console.table(calls.map(call => ({
                startTime: toHumanReadableDuration(call.startTime),
                endTime: toHumanReadableDuration(call.endTime),
                duration: toHumanReadableDuration(call.duration),
                args: JSON.stringify(call.args)
            })));
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
