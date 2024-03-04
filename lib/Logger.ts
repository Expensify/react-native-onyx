type LogData = {
    message: string;
    level: 'alert' | 'info';
};
type LoggerCallback = (data: LogData) => void;

// eslint-disable-next-line @typescript-eslint/no-empty-function
let logger: LoggerCallback = () => {};

/**
 * Register the logging callback
 */
function registerLogger(callback: LoggerCallback) {
    logger = callback;
}

/**
 * Send an alert message to the logger
 */
function logAlert(message: string) {
    logger({message: `[Onyx] ${message}`, level: 'alert'});
}

/**
 * Send an info message to the logger
 */
function logInfo(message: string) {
    logger({message: `[Onyx] ${message}`, level: 'info'});
}

export {registerLogger, logInfo, logAlert};
