"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.result = exports.startsWith = void 0;
const underscore_1 = __importDefault(require("underscore"));
/**
 * Returns true if the haystack begins with the needle
 *
 * @param {String} haystack  The full string to be searched
 * @param {String} needle    The case-sensitive string to search for
 * @return {Boolean} Returns true if the haystack starts with the needle.
 */
function startsWith(haystack, needle) {
    return underscore_1.default.isString(haystack) && underscore_1.default.isString(needle) && haystack.startsWith(needle);
}
exports.startsWith = startsWith;
/**
 * Checks if parameter is a string or function.
 * If it is a string, then we will just return it.
 * If it is a function, then we will call it with
 * any additional arguments and return the result.
 *
 * @param {String|Function} parameter
 * @returns {*}
 */
function result(parameter, ...args) {
    return underscore_1.default.isFunction(parameter) ? parameter(...args) : parameter;
}
exports.result = result;
