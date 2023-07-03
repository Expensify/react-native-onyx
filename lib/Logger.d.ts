declare type LogData = {
    message: string;
    level: 'alert' | 'info';
};

/**
 * Register the logging callback
 *
 * @param callback
 */
declare function registerLogger(callback: (data: LogData) => void): void;

export {registerLogger};
