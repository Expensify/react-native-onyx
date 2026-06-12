const logMessages = {
    incompatibleUpdateAlert: (key: string, operation: string, existingValueType?: string, newValueType?: string) =>
        `Warning: Trying to apply "${operation}" with ${newValueType ?? 'unknown'} type to ${existingValueType ?? 'unknown'} type in the key "${key}"`,
    collectionKeyWriteAlert: (key: string, operation: string) =>
        `Warning: "${operation}" was called with the collection key "${key}". A value cannot be written to a collection key directly — collection members live at "${key}<id>". ` +
        `Use Onyx.mergeCollection()/Onyx.setCollection() for collections, or target an individual member key. This operation was skipped.`,
};

export default logMessages;
