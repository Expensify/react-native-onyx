import _ from 'underscore';
import MDTable from './MDTable';

/**
 * Each key is a method name and the value is an array of calls metadata
 * @type {Record<String, Array<Object>>}
 */
let stats = {};

/* For some reason `performance.now()` does not start from `0` but a very large offset
* like `508,080,000` see: https://github.com/facebook/react-native/issues/30069
* Capturing an offset allows us to record start/ends times relative to app launch time */
const APP_LAUNCH_TIME = performance.now();

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
        const startTime = performance.now() - APP_LAUNCH_TIME;

        const originalPromise = func.apply(this, args);

        /*
        * Then handlers added here are not affecting the original promise
        * They create a separate chain that's not exposed (returned) to the original caller
        * */
        originalPromise
            .finally(() => {
                const endTime = performance.now() - APP_LAUNCH_TIME;

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
 * @param {Object} [options]
 * @param {boolean} [options.raw=false] - setting this to true will print raw instead of human friendly times
 * Useful when you copy the printed table to excel and let excel do the number formatting
 * @param {'console'|'csv'|'json'|'string'} [options.format=console] The output format of this function
 * `string` is useful when __DEV__ is set to `false` as writing to the console is disabled, but the result of this
 * method would still get printed as output
 * @returns {string|undefined}
 */
function printMetrics({raw = false, format = 'console'} = {}) {
    const {totalTime, summaries, lastCompleteCall} = getMetrics();

    const tableSummary = MDTable.factory({
        heading: ['method', 'total time spent', 'max', 'min', 'avg', 'time last call completed', 'calls made'],
        leftAlignedCols: [0],
    });

    const methodCallTables = _.chain(summaries)
        .filter(method => method.avg > 0)
        .sortBy('avg')
        .reverse()
        .map(({methodName, calls, ...methodStats}) => {
            tableSummary.addRow(
                methodName,
                toDuration(methodStats.total, raw),
                toDuration(methodStats.max, raw),
                toDuration(methodStats.min, raw),
                toDuration(methodStats.avg, raw),
                toDuration(methodStats.lastCall.endTime, raw),
                calls.length,
            );

            const callsTable = MDTable.factory({
                title: methodName,
                heading: ['start time', 'end time', 'duration', 'args'],
                leftAlignedCols: [3],
                rows: calls.map(call => ([
                    toDuration(call.startTime, raw),
                    toDuration(call.endTime, raw),
                    toDuration(call.duration, raw),
                    call.args.map(String).join(', ').slice(0, 60), // Restrict cell width to 60 chars max
                ]))
            });

            return callsTable;
        })
        .value();

    if (/csv|json|string/i.test(format)) {
        const allTables = [tableSummary, ...methodCallTables];

        return allTables.map((table) => {
            switch (format.toLowerCase()) {
                case 'csv':
                    return table.toCSV();
                case 'json':
                    return table.toJSON();
                default:
                    return table.toString();
            }
        }).join('\n\n');
    }

    const mainOutput = [
        '### Onyx Benchmark',
        `  - Total: ${toDuration(totalTime, raw)}`,
        `  - Last call finished at: ${lastCompleteCall ? toDuration(lastCompleteCall.endTime, raw) : 'N/A'}`,
        '',
        tableSummary.toString()
    ];

    /* eslint-disable no-console */
    console.info(mainOutput.join('\n'));
    methodCallTables.forEach((table) => {
        console.groupCollapsed(table.getTitle());
        console.info(table.toString());
        console.groupEnd();
    });
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
