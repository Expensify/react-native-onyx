/**
 * Create a deferred task that can be resolved when we call `resolve()`
 * The returned promise will complete when we call `resolve`
 * Useful when we want to wait for a tasks that is resolved from an external action
 *
 * @template T
 * @returns {{ resolve: function(*), promise: Promise<T|void> }}
 */
export default function createDeferredTask<T>(): {
    resolve: (arg0: any) => any;
    promise: Promise<void | T>;
};
//# sourceMappingURL=createDeferredTask.d.ts.map