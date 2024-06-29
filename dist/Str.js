"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.result = exports.startsWith = void 0;
/**
 * Returns true if the haystack begins with the needle
 *
 * @param haystack  The full string to be searched
 * @param needle    The case-sensitive string to search for
 * @return Returns true if the haystack starts with the needle.
 */
function startsWith(haystack, needle) {
    return typeof haystack === 'string' && typeof needle === 'string' && haystack.startsWith(needle);
}
exports.startsWith = startsWith;
function result(parameter, ...args) {
    return typeof parameter === 'function' ? parameter(...args) : parameter;
}
exports.result = result;
