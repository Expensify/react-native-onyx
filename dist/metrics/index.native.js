"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printMetrics = exports.resetMetrics = exports.getMetrics = exports.decorateWithMetrics = void 0;
const underscore_1 = __importDefault(require("underscore"));
const react_native_performance_1 = __importDefault(require("react-native-performance"));
const MDTable_1 = __importDefault(require("../MDTable"));
const decoratedAliases = new Set();
/**
 * Capture a start mark to performance entries
 * @param {string} alias
 * @param {Array<*>} args
 * @returns {{name: string, startTime:number, detail: {args: [], alias: string}}}
 */
function addMark(alias, args) {
    return react_native_performance_1.default.mark(alias, { detail: { args, alias } });
}
/**
 * Capture a measurement between the start mark and now
 * @param {{name: string, startTime:number, detail: {args: []}}} startMark
 * @param {*} detail
 */
function measureMarkToNow(startMark, detail) {
    react_native_performance_1.default.measure(`${startMark.name} [${startMark.detail.args.toString()}]`, {
        start: startMark.startTime,
        end: react_native_performance_1.default.now(),
        detail: Object.assign(Object.assign({}, startMark.detail), detail),
    });
}
/**
 * Wraps a function with metrics capturing logic
 * @param {function} func
 * @param {String} [alias]
 * @returns {function} The wrapped function
 */
function decorateWithMetrics(func, alias = func.name) {
    if (decoratedAliases.has(alias)) {
        throw new Error(`"${alias}" is already decorated`);
    }
    decoratedAliases.add(alias);
    function decorated(...args) {
        const mark = addMark(alias, args);
        // eslint-disable-next-line no-invalid-this
        const originalPromise = func.apply(this, args);
        /*
         * Then handlers added here are not affecting the original promise
         * They create a separate chain that's not exposed (returned) to the original caller
         * */
        originalPromise
            .then((result) => {
            measureMarkToNow(mark, { result });
        })
            .catch((error) => {
            measureMarkToNow(mark, { error });
        });
        return originalPromise;
    }
    return decorated;
}
exports.decorateWithMetrics = decorateWithMetrics;
/**
 * Calculate the total sum of a given key in a list
 * @param {Array<Record<prop, Number>>} list
 * @param {string} prop
 * @returns {number}
 */
function sum(list, prop) {
    return underscore_1.default.reduce(list, (memo, next) => memo + next[prop], 0);
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
    const summaries = underscore_1.default.chain(react_native_performance_1.default.getEntriesByType('measure'))
        .filter((entry) => entry.detail && decoratedAliases.has(entry.detail.alias))
        .groupBy((entry) => entry.detail.alias)
        .map((calls, methodName) => {
        const total = sum(calls, 'duration');
        const avg = total / calls.length || 0;
        const max = underscore_1.default.max(calls, 'duration').duration || 0;
        const min = underscore_1.default.min(calls, 'duration').duration || 0;
        // Latest complete call (by end time) for all the calls made to the current method
        const lastCall = underscore_1.default.max(calls, (call) => call.startTime + call.duration);
        return [
            methodName,
            {
                methodName,
                total,
                max,
                min,
                avg,
                lastCall,
                calls,
            },
        ];
    })
        .object() // Create a map like methodName -> StatSummary
        .value();
    const totalTime = sum(underscore_1.default.values(summaries), 'total');
    // Latest complete call (by end time) of all methods up to this point
    const lastCompleteCall = underscore_1.default.max(underscore_1.default.values(summaries), (summary) => summary.lastCall.startTime + summary.lastCall.duration).lastCall;
    return {
        totalTime,
        summaries,
        lastCompleteCall,
    };
}
exports.getMetrics = getMetrics;
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
 * @param {string[]} [options.methods] Print stats only for these method names
 * @returns {string|undefined}
 */
function printMetrics({ raw = false, format = 'console', methods } = {}) {
    const { totalTime, summaries, lastCompleteCall } = getMetrics();
    const tableSummary = MDTable_1.default.factory({
        heading: ['method', 'total time spent', 'max', 'min', 'avg', 'time last call completed', 'calls made'],
        leftAlignedCols: [0],
    });
    /* Performance marks (startTimes) are relative to system uptime
     * timeOrigin is the point at which the app started to init
     * We use timeOrigin to display times relative to app launch time
     * See: https://github.com/oblador/react-native-performance/issues/50 */
    const timeOrigin = react_native_performance_1.default.timeOrigin;
    const methodNames = underscore_1.default.isArray(methods) ? methods : underscore_1.default.keys(summaries);
    const methodCallTables = underscore_1.default.chain(methodNames)
        .filter((methodName) => summaries[methodName] && summaries[methodName].avg > 0)
        .map((methodName) => {
        const _a = summaries[methodName], { calls } = _a, methodStats = __rest(_a, ["calls"]);
        tableSummary.addRow(methodName, toDuration(methodStats.total, raw), toDuration(methodStats.max, raw), toDuration(methodStats.min, raw), toDuration(methodStats.avg, raw), toDuration(methodStats.lastCall.startTime + methodStats.lastCall.duration - timeOrigin, raw), calls.length);
        return MDTable_1.default.factory({
            title: methodName,
            heading: ['start time', 'end time', 'duration', 'args'],
            leftAlignedCols: [3],
            rows: underscore_1.default.map(calls, (call) => [
                toDuration(call.startTime - react_native_performance_1.default.timeOrigin, raw),
                toDuration(call.startTime + call.duration - timeOrigin, raw),
                toDuration(call.duration, raw),
                underscore_1.default.map(call.detail.args, String).join(', ').slice(0, 60), // Restrict cell width to 60 chars max
            ]),
        });
    })
        .value();
    if (/csv|json|string/i.test(format)) {
        const allTables = [tableSummary, ...methodCallTables];
        return underscore_1.default.map(allTables, (table) => {
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
    const lastComplete = lastCompleteCall && toDuration(lastCompleteCall.startTime + lastCompleteCall.duration - timeOrigin, raw);
    const mainOutput = ['### Onyx Benchmark', `  - Total: ${toDuration(totalTime, raw)}`, `  - Last call finished at: ${lastComplete || 'N/A'}`, '', tableSummary.toString()];
    /* eslint-disable no-console */
    console.info(mainOutput.join('\n'));
    methodCallTables.forEach((table) => {
        console.groupCollapsed(table.getTitle());
        console.info(table.toString());
        console.groupEnd();
    });
    /* eslint-enable */
}
exports.printMetrics = printMetrics;
/**
 * Clears all collected metrics.
 */
function resetMetrics() {
    const { summaries } = getMetrics();
    underscore_1.default.chain(summaries)
        .map((summary) => summary.calls)
        .flatten()
        .each((measure) => {
        react_native_performance_1.default.clearMarks(measure.detail.alias);
        react_native_performance_1.default.clearMeasures(measure.name);
    });
}
exports.resetMetrics = resetMetrics;
