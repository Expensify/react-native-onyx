import performance from 'react-native-performance';
import type {PerformanceMark} from 'react-native-performance';

const decoratedAliases = new Set();

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
 */
function decorateWithMetrics<Args extends unknown[], ReturnType extends Promise<unknown>>(func: (...args: Args) => ReturnType, alias = func.name) {
    if (decoratedAliases.has(alias)) {
        throw new Error(`"${alias}" is already decorated`);
    }

    decoratedAliases.add(alias);
    function decorated(...args: Args) {
        const mark = performance.mark(alias, {detail: {args, alias}});

        const originalPromise = func(...args);

        /*
         * The handlers added here are not affecting the original promise
         * They create a separate chain that's not exposed (returned) to the original caller
         */
        originalPromise
            .then((result) => {
                measureMarkToNow(mark, {result});
            })
            .catch((error) => {
                measureMarkToNow(mark, {error});
            });

        return originalPromise;
    }

    return decorated;
}

export default decorateWithMetrics;
