type Log = {
    message: string,
    level: string,
};

// Logging callback
let logger = (log: Log) => {
    console.debug(log);
};

function registerLogger(callback: (log: Log) => void) {
    logger = callback;
}

function logAlert(message: string) {
    logger({message: `[Onyx] ${message}`, level: 'alert'});
}

function logInfo(message: string) {
    logger({message: `[Onyx] ${message}`, level: 'info'});
}

export {
    registerLogger,
    logInfo,
    logAlert,
};
