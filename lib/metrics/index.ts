/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
// These rules are disabled on purpose to keep types somewhat consistent for all platforms

// For web-only implementations of Onyx, this module will just be a no-op

import type {CallbackFunction, Metrics, PrintMetricsOptions} from './types';

function decorateWithMetrics<TArgs extends unknown[], TPromise>(func: CallbackFunction<TArgs, TPromise>): CallbackFunction<TArgs, TPromise> {
    return func;
}
function getMetrics(): Metrics | void {}
function printMetrics(options: PrintMetricsOptions): string | void {}
function resetMetrics(): void {}

export {decorateWithMetrics, getMetrics, resetMetrics, printMetrics};
