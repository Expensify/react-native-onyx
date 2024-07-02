type LogData = {
    message: string;
    level: 'alert' | 'info' | 'hmmm';
};
type LoggerCallback = (data: LogData) => void;
/**
 * Register the logging callback
 */
declare function registerLogger(callback: LoggerCallback): void;
/**
 * Send an alert message to the logger
 */
declare function logAlert(message: string): void;
/**
 * Send an info message to the logger
 */
declare function logInfo(message: string): void;
/**
 * Send an hmmm message to the logger
 */
declare function logHmmm(message: string): void;
export { registerLogger, logInfo, logAlert, logHmmm };
