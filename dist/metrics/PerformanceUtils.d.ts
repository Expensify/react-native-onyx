/**
 * Provide insights into why a setState() call occurred by diffing the before and after values.
 *
 * @param {Object} mapping
 * @param {*} previousValue
 * @param {*} newValue
 * @param {String} caller
 * @param {String} [keyThatChanged]
 */
export function logSetStateCall(mapping: Object, previousValue: any, newValue: any, caller: string, keyThatChanged?: string | undefined): void;
/**
 * @param {Boolean} debug
 */
export function setShouldDebugSetState(debug: boolean): void;
