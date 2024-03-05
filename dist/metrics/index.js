"use strict";
// For web-only implementations of Onyx, this module will just be a no-op
Object.defineProperty(exports, "__esModule", { value: true });
exports.printMetrics = exports.resetMetrics = exports.getMetrics = exports.decorateWithMetrics = void 0;
function decorateWithMetrics(func) {
    return func;
}
exports.decorateWithMetrics = decorateWithMetrics;
function getMetrics() { }
exports.getMetrics = getMetrics;
function printMetrics() { }
exports.printMetrics = printMetrics;
function resetMetrics() { }
exports.resetMetrics = resetMetrics;
