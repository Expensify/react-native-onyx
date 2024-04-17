const logMessages = {
    incompatibleUpdateAlerts: (key: string, operation: string) => `A warning occurred while applying ${operation} for key: ${key}, Warning: Trying to set array to object or vice versa`,
};

export default logMessages;
