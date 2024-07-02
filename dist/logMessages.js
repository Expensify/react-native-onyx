"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logMessages = {
    incompatibleUpdateAlert: (key, operation, existingValueType, newValueType) => {
        return `Warning: Trying to apply "${operation}" with ${newValueType !== null && newValueType !== void 0 ? newValueType : 'unknown'} type to ${existingValueType !== null && existingValueType !== void 0 ? existingValueType : 'unknown'} type in the key "${key}"`;
    },
};
exports.default = logMessages;
