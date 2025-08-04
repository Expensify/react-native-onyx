import type {OnyxKey, CollectionKeyBase} from './types';
import * as Str from './Str';

// Global set of collection keys - will be initialized by OnyxUtils
let onyxCollectionKeySet = new Set<OnyxKey>();

/**
 * Sets the collection keys set. This should be called during Onyx initialization.
 * @param collectionKeys - Set of collection keys
 */
function setCollectionKeys(collectionKeys: Set<OnyxKey>): void {
    onyxCollectionKeySet = collectionKeys;
}

/**
 * Gets the current collection keys set.
 * @returns Set of collection keys
 */
function getCollectionKeys(): Set<OnyxKey> {
    return onyxCollectionKeySet;
}

/**
 * Checks to see if the provided key is associated with a collection of keys.
 * @param key - The key to check
 * @returns true if the key is a collection key, false otherwise
 */
function isCollectionKey(key: OnyxKey): key is CollectionKeyBase {
    return onyxCollectionKeySet.has(key);
}

/**
 * Checks if a key is a collection member key (starts with a collection key and has additional characters).
 * @param collectionKey - The collection key to check against
 * @param key - The key to check if it's a member of the collection
 * @returns true if the key is a member of the collection, false otherwise
 */
function isCollectionMemberKey<TCollectionKey extends CollectionKeyBase>(collectionKey: TCollectionKey, key: string): key is `${TCollectionKey}${string}` {
    return key.startsWith(collectionKey) && key.length > collectionKey.length;
}

/**
 * Extracts the collection identifier of a given collection member key.
 * @param key - The collection key to process
 * @returns The plain collection key or throws an Error if the key is not a collection one
 */
function getCollectionKey(key: string): string {
    // Start by finding the position of the last underscore in the string
    let lastUnderscoreIndex = key.lastIndexOf('_');

    // Iterate backwards to find the longest key that ends with '_'
    while (lastUnderscoreIndex > 0) {
        const possibleKey = key.slice(0, lastUnderscoreIndex + 1);

        // Check if the substring is a key in the Set
        if (isCollectionKey(possibleKey)) {
            // Return the matching key
            return possibleKey;
        }

        // Move to the next underscore to check smaller possible keys
        lastUnderscoreIndex = key.lastIndexOf('_', lastUnderscoreIndex - 1);
    }

    throw new Error(`Invalid '${key}' key provided, only collection keys are allowed.`);
}

/**
 * Checks if a key matches a pattern (either exact match or collection member match).
 * @param pattern - The pattern to check against (can be a collection key or regular key)
 * @param key - The key to check
 * @returns true if the key matches the pattern, false otherwise
 */
function isKeyMatch(pattern: OnyxKey, key: OnyxKey): boolean {
    return isCollectionKey(pattern) ? Str.startsWith(key, pattern) : pattern === key;
}

export {setCollectionKeys, getCollectionKeys, isCollectionKey, isCollectionMemberKey, getCollectionKey, isKeyMatch};
