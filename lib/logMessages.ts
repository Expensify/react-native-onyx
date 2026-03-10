const logMessages = {
    incompatibleUpdateAlert: (key: string, operation: string, existingValueType?: string, newValueType?: string) =>
        `Warning: Trying to apply "${operation}" with ${newValueType ?? 'unknown'} type to ${existingValueType ?? 'unknown'} type in the key "${key}"`,
    collectionKeyOperationAlert: (key: string, operation: 'set' | 'merge') =>
        `Trying to use "${operation}" with collection key "${key}". Use setCollection / mergeCollection instead.`,
};

export default logMessages;
