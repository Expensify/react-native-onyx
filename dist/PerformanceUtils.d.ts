import type { OnyxKey } from './types';
import type { Mapping } from './Onyx';
declare function setShouldDebugSetState(debug: boolean): void;
/**
 * Provide insights into why a setState() call occurred by diffing the before and after values.
 */
declare function logSetStateCall<TKey extends OnyxKey>(mapping: Mapping<TKey>, previousValue: unknown, newValue: unknown, caller: string, keyThatChanged?: string): void;
export { logSetStateCall, setShouldDebugSetState };
