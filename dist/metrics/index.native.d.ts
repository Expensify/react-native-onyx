/**
 * Wraps a function with metrics capturing logic
 * @param {function} func
 * @param {String} [alias]
 * @returns {function} The wrapped function
 */
export function decorateWithMetrics(func: Function, alias?: string | undefined): Function;
/**
 * Aggregates and returns benchmark information
 * @returns {{summaries: Record<string, Object>, totalTime: number, lastCompleteCall: *}}
 * An object with
 * - `totalTime` - total time spent by decorated methods
 * - `lastCompleteCall` - millisecond since launch the last call completed at
 * - `summaries` - mapping of all captured stats: summaries.methodName -> method stats
 */
export function getMetrics(): {
    summaries: Record<string, Object>;
    totalTime: number;
    lastCompleteCall: any;
};
/**
 * Clears all collected metrics.
 */
export function resetMetrics(): void;
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
export function printMetrics({ raw, format, methods }?: {
    raw?: boolean | undefined;
    format?: "string" | "console" | "csv" | "json" | undefined;
    methods?: string[] | undefined;
} | undefined): string | undefined;
