/**
 * Returns the value at the given index, throwing if it is missing.
 * Prefer this over non-null assertions when satisfying rulesdir/prefer-at.
 */
function getAtIndex<T>(array: T[], index: number): T {
    const value = array.at(index);

    if (value === undefined) {
        throw new Error(`Expected value at index ${index}`);
    }

    return value;
}

export default getAtIndex;
