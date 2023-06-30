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

export {registerLogger};
