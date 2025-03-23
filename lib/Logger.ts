type LogData = {
    message: string;
    level: 'alert' | 'info' | 'hmmm';
    extraData?: Record<string, unknown>;
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
function logAlert(message: string, extraData?: Record<string, unknown>) {
    logger({message: `[Onyx] ${message}`, level: 'alert', extraData});
}

/**
 * Send an info message to the logger
 */
function logInfo(message: string, extraData?: Record<string, unknown>) {
    logger({message: `[Onyx] ${message}`, level: 'info', extraData});
}

/**
 * Send an hmmm message to the logger
 */
function logHmmm(message: string, extraData?: Record<string, unknown>) {
    logger({message: `[Onyx] ${message}`, level: 'hmmm', extraData});
}

export {registerLogger, logInfo, logAlert, logHmmm};
