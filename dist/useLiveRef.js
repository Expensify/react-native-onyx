"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
/**
 * Creates a mutable reference to a value, useful when you need to
 * maintain a reference to a value that may change over time without triggering re-renders.
 */
function useLiveRef(value) {
    const ref = (0, react_1.useRef)(value);
    ref.current = value;
    return ref;
}
exports.default = useLiveRef;
