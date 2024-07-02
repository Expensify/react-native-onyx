/// <reference types="react" />
/**
 * Creates a mutable reference to a value, useful when you need to
 * maintain a reference to a value that may change over time without triggering re-renders.
 */
declare function useLiveRef<T>(value: T): import("react").MutableRefObject<T>;
export default useLiveRef;
