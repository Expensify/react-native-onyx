"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
/**
 * Returns the previous value of the provided value.
 */
function usePrevious(value) {
    const ref = (0, react_1.useRef)(value);
    (0, react_1.useEffect)(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}
exports.default = usePrevious;
