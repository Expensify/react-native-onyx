/**
 * Returns true if the haystack begins with the needle
 *
 * @param {String} haystack  The full string to be searched
 * @param {String} needle    The case-sensitive string to search for
 * @return {Boolean} Returns true if the haystack starts with the needle.
 */
export function startsWith(haystack: string, needle: string): boolean;
/**
 * Checks if parameter is a string or function.
 * If it is a string, then we will just return it.
 * If it is a function, then we will call it with
 * any additional arguments and return the result.
 *
 * @param {String|Function} parameter
 * @returns {*}
 */
export function result(parameter: string | Function, ...args: any[]): any;
