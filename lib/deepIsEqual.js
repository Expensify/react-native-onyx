import _ from 'underscore';

/**
 * @param {*} oldValue
 * @param {*} newValue
 * @returns {Boolean}
 */
export default function deepIsEqual(oldValue, newValue) {
    if (newValue === oldValue) {
        return true;
    }

    if ((newValue === null && oldValue === undefined) || (oldValue === null && newValue === undefined)) {
        return false;
    }

    if ((newValue !== null && newValue !== undefined) && (oldValue === null || oldValue === undefined)) {
        return false;
    }

    if ((oldValue !== null && oldValue !== undefined) && (newValue === null || newValue === undefined)) {
        return false;
    }

    const newValueProperties = Object.getOwnPropertyNames(newValue);
    const oldValueProperties = Object.getOwnPropertyNames(oldValue);

    if (_.isNumber(oldValue) && _.isNumber(newValue)) {
        return oldValue === newValue;
    }

    if (newValueProperties.length !== oldValueProperties.length) {
        return false;
    }

    for (let i = 0; i < newValueProperties.length; i++) {
        const property = newValueProperties[i];
        if (_.isObject(newValue[property])) {
            // eslint-disable-next-line no-unused-vars
            if (!deepIsEqual(newValue[property], oldValue[property])) {
                return false;
            }
            break;
        }

        if (_.isNumber(newValue[property])) {
            if (_.isNaN(newValue[property]) && _.isNaN(oldValue[property])) {
                break;
            }
        }

        if (newValue[property] !== oldValue[property]) {
            return false;
        }
    }

    return true;
}
