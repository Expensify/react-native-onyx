import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import Onyx from './Onyx';
// eslint-disable-next-line rulesdir/prefer-import-module-contents
import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxEntry, OnyxKey} from './types';

type OnyxValue<TKey extends OnyxKey> = TKey extends CollectionKeyBase ? OnyxCollection<KeyValueMapping[TKey]> : OnyxEntry<KeyValueMapping[TKey]>;

type UseOnyxOptions<TKey extends OnyxKey> = {
    /**
     * Determines if this key in this subscription is safe to be evicted.
     */
    canEvict?: boolean;

    /**
     * If set to false, then no data will be prefilled into the component.
     */
    initWithStoredValues?: boolean;

    /**
     * TODO: Check if we still need this flag and associated logic.
     */
    allowStaleData?: boolean;

    /**
     * Sets an initial value to be returned by the hook during the first render.
     */
    initialValue?: OnyxValue<TKey>;
};

function useOnyx<TKey extends OnyxKey>(key: TKey, options?: UseOnyxOptions<TKey>): OnyxValue<TKey> {
    const [value, setValue] = useState<OnyxValue<TKey>>(options?.initialValue ?? (null as OnyxValue<TKey>));

    const connectionIDRef = useRef<number | null>(null);

    useEffect(() => {
        connectionIDRef.current = Onyx.connect({
            key: key as CollectionKeyBase,
            callback: (val: unknown) => {
                setValue(val as OnyxValue<TKey>);
            },
            initWithStoredValues: options?.initWithStoredValues,
            waitForCollectionCallback: Onyx.isCollectionKey(key),
        });

        return () => {
            if (!connectionIDRef.current) {
                return;
            }

            Onyx.disconnect(connectionIDRef.current);
        };
    }, [key, options?.initWithStoredValues]);

    /**
     * Mimics withOnyx's checkEvictableKeys() behavior.
     */
    useEffect(() => {
        if (options?.canEvict === undefined || !connectionIDRef.current) {
            return;
        }

        if (!Onyx.isSafeEvictionKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
        }

        if (options.canEvict) {
            Onyx.removeFromEvictionBlockList(key, connectionIDRef.current);
        } else {
            Onyx.addToEvictionBlockList(key, connectionIDRef.current);
        }
    }, [key, options?.canEvict]);

    return value;
}

const cache = new Map<string, unknown>();

function useOnyxWithSyncExternalStore<TKey extends OnyxKey>(key: TKey, options?: UseOnyxOptions<TKey>): OnyxValue<TKey> {
    const connectionIDRef = useRef<number | null>(null);

    const getSnapshot = useCallback(() => {
        return (cache.get(key) ?? null) as OnyxValue<TKey>;
    }, [key]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            connectionIDRef.current = Onyx.connect({
                key: key as CollectionKeyBase,
                callback: (val: unknown) => {
                    cache.set(key, val);
                    onStoreChange();
                },
                initWithStoredValues: options?.initWithStoredValues,
                waitForCollectionCallback: Onyx.isCollectionKey(key),
            });

            return () => {
                if (!connectionIDRef.current) {
                    return;
                }

                Onyx.disconnect(connectionIDRef.current);
            };
        },
        [key, options?.initWithStoredValues],
    );

    /**
     * Mimics withOnyx's checkEvictableKeys() behavior.
     */
    useEffect(() => {
        if (options?.canEvict === undefined || !connectionIDRef.current) {
            return;
        }

        if (!Onyx.isSafeEvictionKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
        }

        if (options.canEvict) {
            Onyx.removeFromEvictionBlockList(key, connectionIDRef.current);
        } else {
            Onyx.addToEvictionBlockList(key, connectionIDRef.current);
        }
    }, [key, options?.canEvict]);

    const value = useSyncExternalStore<OnyxValue<TKey>>(subscribe, getSnapshot);

    return value;
}

export {useOnyx, useOnyxWithSyncExternalStore};
