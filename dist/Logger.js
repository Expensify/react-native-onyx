"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAlert = exports.logInfo = exports.registerLogger = void 0;
// Logging callback
let logger = () => { };
/**
 * Register the logging callback
 *
 * @param {Function} callback
 */
function registerLogger(callback) {
    logger = callback;
}
exports.registerLogger = registerLogger;
/**
 * Send an alert message to the logger
 *
 * @param {String} message
 */
function logAlert(message) {
    logger({ message: `[Onyx] ${message}`, level: 'alert' });
}
exports.logAlert = logAlert;
/**
 * Send an info message to the logger
 *
 * @param {String} message
 */
function logInfo(message) {
    logger({ message: `[Onyx] ${message}`, level: 'info' });
}
exports.logInfo = logInfo;
