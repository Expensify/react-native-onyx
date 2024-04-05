type LogData = {
    message: string;
    level: 'alert' | 'info' | 'hmmm';
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

/**
 * Send an hmmm message to the logger
 */
function logHmmm(message: string) {
    logger({message: `[Onyx] ${message}`, level: 'hmmm'});
}

export {registerLogger, logInfo, logAlert, logHmmm};
