const logMessages = {
    incompatibleUpdateAlert: (key: string, operation: string, existingValueType?: string, newValueType?: string) =>
        `Warning: Trying to apply "${operation}" with ${newValueType ?? 'unknown'} type to ${existingValueType ?? 'unknown'} type in the key "${key}"`,
};

export default logMessages;
