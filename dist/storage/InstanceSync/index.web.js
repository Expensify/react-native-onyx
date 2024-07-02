"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const NoopProvider_1 = __importDefault(require("../providers/NoopProvider"));
const SYNC_ONYX = 'SYNC_ONYX';
/**
 * Raise an event through `localStorage` to let other tabs know a value changed
 * @param {String} onyxKey
 */
function raiseStorageSyncEvent(onyxKey) {
    global.localStorage.setItem(SYNC_ONYX, onyxKey);
    global.localStorage.removeItem(SYNC_ONYX);
}
function raiseStorageSyncManyKeysEvent(onyxKeys) {
    onyxKeys.forEach((onyxKey) => {
        raiseStorageSyncEvent(onyxKey);
    });
}
let storage = NoopProvider_1.default;
const InstanceSync = {
    shouldBeUsed: true,
    /**
     * @param {Function} onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    init: (onStorageKeyChanged, store) => {
        storage = store;
        // This listener will only be triggered by events coming from other tabs
        global.addEventListener('storage', (event) => {
            // Ignore events that don't originate from the SYNC_ONYX logic
            if (event.key !== SYNC_ONYX || !event.newValue) {
                return;
            }
            const onyxKey = event.newValue;
            storage.getItem(onyxKey).then((value) => onStorageKeyChanged(onyxKey, value));
        });
    },
    setItem: raiseStorageSyncEvent,
    removeItem: raiseStorageSyncEvent,
    removeItems: raiseStorageSyncManyKeysEvent,
    multiMerge: raiseStorageSyncManyKeysEvent,
    multiSet: raiseStorageSyncManyKeysEvent,
    mergeItem: raiseStorageSyncEvent,
    clear: (clearImplementation) => {
        let allKeys;
        // The keys must be retrieved before storage is cleared or else the list of keys would be empty
        return storage
            .getAllKeys()
            .then((keys) => {
            allKeys = keys;
        })
            .then(() => clearImplementation())
            .then(() => {
            // Now that storage is cleared, the storage sync event can happen which is a more atomic action
            // for other browser tabs
            raiseStorageSyncManyKeysEvent(allKeys);
        });
    },
};
exports.default = InstanceSync;
