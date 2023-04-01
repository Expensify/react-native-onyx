/**
 * Create a deferred task that can be resolved when we call `resolve()`
 * The returned promise will complete when we call `resolve`
 * Useful when we want to wait for a tasks that is resolved from an external action
 */

type DeferredObject<T> = {
    promise?: Promise<T>,
    resolve?: (value: T) => void,
}

export default function createDeferredTask() {
    const deferred: DeferredObject<any> = {};
    deferred.promise = new Promise((res) => {
        deferred.resolve = res;
    });

    return deferred;
}
