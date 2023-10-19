declare function fastMerge<T>(
    target: T,
    source: T,
    shouldRemoveNullObjectValues: boolean = true
): T;

export default { fastMerge };
