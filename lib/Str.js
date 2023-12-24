import _ from 'underscore';

/**
 * Returns true if the haystack begins with the needle
 *
 * @param {String} haystack  The full string to be searched
 * @param {String} needle    The case-sensitive string to search for
 * @return {Boolean} Returns true if the haystack starts with the needle.
 */
function startsWith(haystack, needle) {
    return _.isString(haystack) && _.isString(needle) && haystack.startsWith(needle);
}

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
    return _.isFunction(parameter) ? parameter(...args) : parameter;
}

/**
 * A simple GUID generator taken from https://stackoverflow.com/a/32760401/9114791
 *
 * @param {String} [prefix] an optional prefix to put in front of the guid
 * @returns {String}
 */
function guid(prefix = '') {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return `${prefix}${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export {guid, startsWith, result};
