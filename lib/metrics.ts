import PerformanceProxy from './dependencies/PerformanceProxy';

const decoratedAliases = new Set();

/**
 * Capture a measurement between the start mark and now
 */
function measureMarkToNow(startMark: PerformanceMark, detail: Record<string, unknown>) {
    PerformanceProxy.measure(`${startMark.name} [${startMark.detail.args.toString()}]`, {
        start: startMark.startTime,
        end: PerformanceProxy.now(),
        detail: {...startMark.detail, ...detail},
    });
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
    return value != null && typeof value === 'object' && 'then' in value;
}

/**
 * Wraps a function with metrics capturing logic
 */
function decorateWithMetrics<Args extends unknown[], ReturnType>(func: (...args: Args) => ReturnType, alias = func.name) {
    if (decoratedAliases.has(alias)) {
        throw new Error(`"${alias}" is already decorated`);
    }

    decoratedAliases.add(alias);
    function decorated(...args: Args) {
        const mark = PerformanceProxy.mark(alias, {detail: {args, alias}});

        const originalReturnValue = func(...args);

        if (isPromiseLike(originalReturnValue)) {
            /*
             * The handlers added here are not affecting the original promise
             * They create a separate chain that's not exposed (returned) to the original caller
             */
            originalReturnValue
                .then((result) => {
                    measureMarkToNow(mark, {result});
                })
                .catch((error) => {
                    measureMarkToNow(mark, {error});
                });

            return originalReturnValue;
        }

        measureMarkToNow(mark, {result: originalReturnValue});
        return originalReturnValue;
    }
    decorated.name = `${alias}_DECORATED`;

    return decorated;
}

export default decorateWithMetrics;
