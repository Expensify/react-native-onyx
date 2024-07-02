/**
 * The InstancesSync object provides data-changed events like the ones that exist
 * when using LocalStorage APIs in the browser. These events are great because multiple tabs can listen for when
 * data changes and then stay up-to-date with everything happening in Onyx.
 */
import type { OnyxKey } from '../../types';
import type { KeyList, OnStorageKeyChanged } from '../providers/types';
import type StorageProvider from '../providers/types';
/**
 * Raise an event through `localStorage` to let other tabs know a value changed
 * @param {String} onyxKey
 */
declare function raiseStorageSyncEvent(onyxKey: OnyxKey): void;
declare function raiseStorageSyncManyKeysEvent(onyxKeys: KeyList): void;
declare const InstanceSync: {
    shouldBeUsed: boolean;
    /**
     * @param {Function} onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    init: (onStorageKeyChanged: OnStorageKeyChanged, store: StorageProvider) => void;
    setItem: typeof raiseStorageSyncEvent;
    removeItem: typeof raiseStorageSyncEvent;
    removeItems: typeof raiseStorageSyncManyKeysEvent;
    multiMerge: typeof raiseStorageSyncManyKeysEvent;
    multiSet: typeof raiseStorageSyncManyKeysEvent;
    mergeItem: typeof raiseStorageSyncEvent;
    clear: (clearImplementation: () => void) => Promise<void>;
};
export default InstanceSync;
