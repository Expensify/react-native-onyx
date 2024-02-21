type DeferredTask = {
    promise: Promise<unknown>;
    resolve: (value: unknown) => void;
};

/**
 * Create a deferred task that can be resolved when we call `resolve()`
 * The returned promise will complete when we call `resolve`
 * Useful when we want to wait for a tasks that is resolved from an external action
 */
export default function createDeferredTask(): DeferredTask {
    const deferred: DeferredTask = {} as DeferredTask;

    deferred.promise = new Promise((res) => {
        deferred.resolve = res;
    });

    return deferred;
}
