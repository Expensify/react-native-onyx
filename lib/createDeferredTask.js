/**
 * Create a deferred task that can be resolved when we call `resolve()`
 * The returned promise will complete only when we call `resolve` or `reject`
 * Useful when we want to wait for a tasks that is resolved from an external action
 *
 * @template T
 * @returns {{ resolve: function(*), reject: function(Error), promise: Promise<T|void> }}
 */
export default function createDeferredTask() {
    const deferred = {};
    deferred.promise = new Promise((res, rej) => {
        deferred.resolve = res;
        deferred.reject = rej;
    });

    return deferred;
}
