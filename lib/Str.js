import _ from 'underscore';

const Str = {
    /**
     * Returns true if the haystack begins with the needle
     *
     * @param {String} haystack  The full string to be searched
     * @param {String} needle    The case-sensitive string to search for
     * @return {Boolean} Retruns true if the haystack starts with the needle.
     */
    startsWith(haystack, needle) {
        return _.isString(haystack)
                && _.isString(needle)
                && haystack.substring(0, needle.length) === needle;
    },

    /**
     * Checks if parameter is a string or function
     * if it is a function then we will call it with
     * any additional arguments.
     *
     * @param {String|Function} parameter
     * @returns {String}
     */
    result(parameter, ...args) {
        return _.isFunction(parameter) ? parameter(...args) : parameter;
    },
};

export default Str;
