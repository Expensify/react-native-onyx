declare type LogData = {
    message: string;
    level: 'alert' | 'info';
};

/**
 * Register the logging callback
 *
 * @param {Function} callback
 */
declare function registerLogger(callback: (data: LogData) => void): void;

/**
 * Send an alert message to the logger
 *
 * @param {String} message
 */
declare function logAlert(message: any): void;

/**
 * Send an info message to the logger
 *
 * @param {String} message
 */
declare function logInfo(message: any): void;

export {logAlert, logInfo, registerLogger};
