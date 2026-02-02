type DeferredTask = {
    promise: Promise<void>;
    resolve?: () => void;
    isResolved: boolean;
};

/**
 * Create a deferred task that can be resolved when we call `resolve()`
 * The returned promise will complete when we call `resolve`
 * Useful when we want to wait for a tasks that is resolved from an external action
 */
export default function createDeferredTask(): DeferredTask {
    const deferred = {} as DeferredTask;
    deferred.isResolved = false;

    deferred.promise = new Promise((res) => {
        deferred.resolve = () => {
            deferred.isResolved = true;
            res();
        };
    });

    return deferred;
}

export type {DeferredTask};
