"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logHmmm = exports.logAlert = exports.logInfo = exports.registerLogger = void 0;
// eslint-disable-next-line @typescript-eslint/no-empty-function
let logger = () => { };
/**
 * Register the logging callback
 */
function registerLogger(callback) {
    logger = callback;
}
exports.registerLogger = registerLogger;
/**
 * Send an alert message to the logger
 */
function logAlert(message) {
    logger({ message: `[Onyx] ${message}`, level: 'alert' });
}
exports.logAlert = logAlert;
/**
 * Send an info message to the logger
 */
function logInfo(message) {
    logger({ message: `[Onyx] ${message}`, level: 'info' });
}
exports.logInfo = logInfo;
/**
 * Send an hmmm message to the logger
 */
function logHmmm(message) {
    logger({ message: `[Onyx] ${message}`, level: 'hmmm' });
}
exports.logHmmm = logHmmm;
