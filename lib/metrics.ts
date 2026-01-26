import PerformanceProxy from './dependencies/PerformanceProxy';

type PerformanceMarkDetail = {
    result?: unknown;
    error?: unknown;
};

/**
 * Capture a measurement between the start mark and now
 */
function measureMarkToNow(startMark: PerformanceMark, detail?: PerformanceMarkDetail) {
    PerformanceProxy.measure(startMark.name, {
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
    function decorated(...args: Args) {
        const mark = PerformanceProxy.mark(alias, {detail: {alias}});

        const originalReturnValue = func(...args);

        if (isPromiseLike(originalReturnValue)) {
            /*
             * The handlers added here are not affecting the original promise
             * They create a separate chain that's not exposed (returned) to the original caller
             */
            originalReturnValue
                .then(() => {
                    measureMarkToNow(mark);
                })
                .catch((error) => {
                    measureMarkToNow(mark, {error});
                });

            return originalReturnValue;
        }

        measureMarkToNow(mark);
        return originalReturnValue;
    }

    return decorated;
}

export default decorateWithMetrics;
