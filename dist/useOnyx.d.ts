import type { IsEqual } from 'type-fest';
import type { CollectionKeyBase, OnyxCollection, OnyxEntry, OnyxKey, OnyxValue, Selector } from './types';
type BaseUseOnyxOptions = {
    /**
     * Determines if this key in this subscription is safe to be evicted.
     */
    canEvict?: boolean;
    /**
     * If set to false, then no data will be prefilled into the component.
     */
    initWithStoredValues?: boolean;
    /**
     * If set to true, data will be retrieved from cache during the first render even if there is a pending merge for the key.
     */
    allowStaleData?: boolean;
};
type UseOnyxInitialValueOption<TInitialValue> = {
    /**
     * This value will be returned by the hook on the first render while the data is being read from Onyx.
     */
    initialValue?: TInitialValue;
};
type UseOnyxSelectorOption<TKey extends OnyxKey, TReturnValue> = {
    /**
     * This will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `useOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     */
    selector?: Selector<TKey, unknown, TReturnValue>;
};
type FetchStatus = 'loading' | 'loaded';
type SelectedValue<TKey, TValue> = TKey extends CollectionKeyBase ? OnyxCollection<TValue> : OnyxEntry<TValue>;
type CachedValue<TKey extends OnyxKey, TValue> = IsEqual<TValue, OnyxValue<TKey>> extends true ? TValue : SelectedValue<TKey, TValue>;
type ResultMetadata = {
    status: FetchStatus;
};
type UseOnyxResult<TKey extends OnyxKey, TValue> = [CachedValue<TKey, TValue>, ResultMetadata];
declare function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: BaseUseOnyxOptions & UseOnyxInitialValueOption<TReturnValue> & Required<UseOnyxSelectorOption<TKey, TReturnValue>>): UseOnyxResult<TKey, TReturnValue>;
declare function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: BaseUseOnyxOptions & UseOnyxInitialValueOption<NoInfer<TReturnValue>>): UseOnyxResult<TKey, TReturnValue>;
export default useOnyx;
export type { FetchStatus, ResultMetadata, UseOnyxResult };
