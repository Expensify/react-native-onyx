"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Create a deferred task that can be resolved when we call `resolve()`
 * The returned promise will complete when we call `resolve`
 * Useful when we want to wait for a tasks that is resolved from an external action
 */
function createDeferredTask() {
    const deferred = {};
    deferred.promise = new Promise((res) => {
        deferred.resolve = res;
    });
    return deferred;
}
exports.default = createDeferredTask;
