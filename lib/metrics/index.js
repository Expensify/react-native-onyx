// For web-only implementations of Onyx, this module will just be a no-op

function decorateWithMetrics(func) {
    return func;
}
function getMetrics() {}
function printMetrics() {}
function resetMetrics() {}

export {decorateWithMetrics, getMetrics, resetMetrics, printMetrics};
