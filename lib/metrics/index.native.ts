import type {PerformanceMark, PerformanceMeasure} from 'react-native-performance';
import performance from 'react-native-performance';
import MDTable from '../MDTable';
import type {CallbackFunction, Metrics, PrintMetricsOptions, Summary} from './types';
import {minBy, maxBy} from '../utils';

const decoratedAliases = new Set();

/**
 * Capture a start mark to performance entries
 */
function addMark(alias: string, args: unknown[]): PerformanceMark {
    return performance.mark(alias, {detail: {args, alias}});
}

/**
 * Capture a measurement between the start mark and now
 */
function measureMarkToNow(startMark: PerformanceMark, detail: Record<string, unknown>) {
    performance.measure(`${startMark.name} [${startMark.detail.args.toString()}]`, {
        start: startMark.startTime,
        end: performance.now(),
        detail: {...startMark.detail, ...detail},
    });
}

/**
 * Wraps a function with metrics capturing logic
 * @returns The wrapped function
 */
function decorateWithMetrics<TArgs extends unknown[], TPromise>(func: CallbackFunction<TArgs, TPromise>, alias = func.name): CallbackFunction<TArgs, TPromise> {
    if (decoratedAliases.has(alias)) {
        throw new Error(`"${alias}" is already decorated`);
    }

    decoratedAliases.add(alias);

    function decorated(this: unknown, ...args: TArgs): Promise<TPromise> {
        const mark = addMark(alias, args);

        // eslint-disable-next-line no-invalid-this
        const originalPromise = func.apply(this, args);

        /*
         * Then handlers added here are not affecting the original promise
         * They create a separate chain that's not exposed (returned) to the original caller
         * */
        originalPromise
            .then((result: TPromise) => {
                measureMarkToNow(mark, {result});
            })
            .catch((error) => {
                measureMarkToNow(mark, {error});
            });

        return originalPromise;
    }

    return decorated;
}

/**
 * Calculate the total sum of a given key in a list
 */
function sum<T>(list: T[], prop: keyof T): number {
    return list.reduce((memo, next) => {
        const nextProp = next[prop];

        return typeof nextProp === 'number' ? memo + nextProp : memo;
    }, 0);
}

/**
 * Aggregates and returns benchmark information
 * @returns An object with
 * - `totalTime` - total time spent by decorated methods
 * - `lastCompleteCall` - millisecond since launch the last call completed at
 * - `summaries` - mapping of all captured stats: summaries.methodName -> method stats
 */
function getMetrics(): Metrics {
    const groupedMeasures = performance
        .getEntriesByType('measure')
        .filter((entry) => entry.detail && decoratedAliases.has(entry.detail.alias))
        .reduce((obj: Record<string, PerformanceMeasure[]>, entry) => {
            const alias: string = entry.detail.alias;
            if (!(alias in obj)) {
                // eslint-disable-next-line no-param-reassign
                obj[alias] = [];
            }

            obj[alias].push(entry);

            return obj;
        }, {});

    const summaries: Record<string, Summary> = {};
    Object.keys(groupedMeasures).forEach((methodName) => {
        const calls = groupedMeasures[methodName];
        const total = sum(calls, 'duration');
        const avg = total / calls.length || 0;
        const max = maxBy(calls, (call) => call.duration)?.duration || 0;
        const min = minBy(calls, (call) => call.duration)?.duration || 0;

        // Latest complete call (by end time) for all the calls made to the current method
        const lastCall = maxBy(calls, (call) => call.startTime + call.duration);

        if (typeof lastCall === 'number') {
            return;
        }

        summaries[methodName] = {
            methodName,
            total,
            max,
            min,
            avg,
            lastCall,
            calls,
        };
    });

    const totalTime = sum(Object.values(summaries), 'total');

    // Latest complete call (by end time) of all methods up to this point
    const lastCompleteCall = maxBy(Object.values(summaries), (summary) => (!summary.lastCall ? 0 : summary.lastCall?.startTime + summary.lastCall?.duration)).lastCall;

    return {
        totalTime,
        summaries,
        lastCompleteCall,
    };
}

/**
 * Convert milliseconds to human readable time
 */
function toDuration(millis: number, raw = false): string | number {
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
 * @param options
 * @param [options.raw] setting this to true will print raw instead of human friendly times
 * Useful when you copy the printed table to excel and let excel do the number formatting
 * @param [options.format] The output format of this function
 * `string` is useful when __DEV__ is set to `false` as writing to the console is disabled, but the result of this
 * method would still get printed as output
 * @param [options.methods] Print stats only for these method names
 */
function printMetrics({raw = false, format = 'console', methods}: PrintMetricsOptions): string | undefined {
    const {totalTime, summaries, lastCompleteCall} = getMetrics();

    const tableSummary = MDTable.factory({
        heading: ['method', 'total time spent', 'max', 'min', 'avg', 'time last call completed', 'calls made'],
        leftAlignedCols: [0],
    });

    /* Performance marks (startTimes) are relative to system uptime
     * timeOrigin is the point at which the app started to init
     * We use timeOrigin to display times relative to app launch time
     * See: https://github.com/oblador/react-native-performance/issues/50 */
    const timeOrigin = performance.timeOrigin;
    const methodNames = Array.isArray(methods) ? methods : Object.keys(summaries);

    const methodCallTables = methodNames
        .filter((methodName) => summaries[methodName] && summaries[methodName].avg > 0)
        .map((methodName) => {
            const {calls, ...methodStats} = summaries[methodName];
            tableSummary.addRow(
                methodName,
                toDuration(methodStats.total, raw),
                toDuration(methodStats.max, raw),
                toDuration(methodStats.min, raw),
                toDuration(methodStats.avg, raw),
                toDuration(!methodStats.lastCall ? 0 : methodStats.lastCall?.startTime + methodStats.lastCall?.duration - timeOrigin, raw),
                calls.length,
            );

            return MDTable.factory({
                title: methodName,
                heading: ['start time', 'end time', 'duration', 'args'],
                leftAlignedCols: [3],
                rows: calls.map((call) => [
                    toDuration(call.startTime - performance.timeOrigin, raw),
                    toDuration(call.startTime + call.duration - timeOrigin, raw),
                    toDuration(call.duration, raw),
                    call.detail.args
                        .map((item: unknown) => `${item}`)
                        .join(', ')
                        .slice(0, 60), // Restrict cell width to 60 chars max
                ]),
            });
        });

    if (/csv|json|string/i.test(format)) {
        const allTables = [tableSummary, ...methodCallTables];

        return allTables
            .map((table) => {
                switch (format.toLowerCase()) {
                    case 'csv':
                        return table.toCSV();
                    case 'json':
                        return table.toJSON();
                    default:
                        return table.toString();
                }
            })
            .join('\n\n');
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

/**
 * Clears all collected metrics.
 */
function resetMetrics() {
    const {summaries} = getMetrics();

    Object.values(summaries).forEach((summary) => {
        summary.calls.forEach((measure) => {
            performance.clearMarks(measure.detail.alias);
            performance.clearMeasures(measure.name);
        });
    });
}

export {decorateWithMetrics, getMetrics, resetMetrics, printMetrics};
