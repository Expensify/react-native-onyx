import type {CollectionKeyBase, CollectionKey, OnyxKey} from './types';

/** Single source of truth for the set of registered collection keys */
let collectionKeySet = new Set<OnyxKey>();

/** Reverse lookup: member key → collection key for O(1) access */
const memberToCollectionKeyMap = new Map<OnyxKey, OnyxKey>();

/** Forward lookup: collection key → set of member keys for O(collectionMembers) iteration */
const collectionToMembersMap = new Map<OnyxKey, Set<OnyxKey>>();

/** Set of keys that should only be stored in RAM, not persisted to storage */
let ramOnlyKeySet = new Set<OnyxKey>();

/**
 * Initializes the collection key set. Called once during Onyx.init().
 */
function setCollectionKeys(keys: Set<OnyxKey>): void {
    collectionKeySet = keys;
}

/**
 * Returns the set of all registered collection keys.
 */
function getCollectionKeys(): Set<OnyxKey> {
    return collectionKeySet;
}

/**
 * Checks if the given key is a registered collection key (e.g. "report_").
 */
function isCollectionKey(key: OnyxKey): key is CollectionKeyBase {
    return collectionKeySet.has(key);
}

/**
 * Checks if the given key is a member of the specified collection key.
 * e.g. isCollectionMemberKey("report_", "report_123") → true
 */
function isCollectionMemberKey<TCollectionKey extends CollectionKeyBase>(collectionKey: TCollectionKey, key: string): key is `${TCollectionKey}${string}` {
    return key.startsWith(collectionKey) && key.length > collectionKey.length;
}

/**
 * Checks if a given key is a collection member key (not just a collection key).
 */
function isCollectionMember(key: OnyxKey): boolean {
    const collectionKey = getCollectionKey(key);
    return !!collectionKey && key.length > collectionKey.length;
}

/**
 * Checks if the provided key matches the config key — either an exact match
 * or a collection prefix match.
 */
function isKeyMatch(configKey: OnyxKey, key: OnyxKey): boolean {
    return isCollectionKey(configKey) ? key.startsWith(configKey) : configKey === key;
}

/**
 * Extracts the collection key from a collection member key.
 *
 * Uses a pre-computed Map for O(1) lookup. Falls back to string parsing
 * for keys not yet in the map (e.g. before they're cached).
 *
 * Examples:
 * - getCollectionKey("report_123") → "report_"
 * - getCollectionKey("report_") → "report_"
 * - getCollectionKey("sharedNVP_user_-1_something") → "sharedNVP_user_"
 */
function getCollectionKey(key: CollectionKey | OnyxKey): string | undefined {
    // Fast path: O(1) Map lookup for known member keys
    const cached = memberToCollectionKeyMap.get(key);
    if (cached !== undefined) {
        return cached;
    }

    // If the key itself is a collection key, return it directly
    if (isCollectionKey(key)) {
        return key;
    }

    // Slow path: string parsing — use a `string` variable to avoid
    // TypeScript narrowing `key` to `never` after the isCollectionKey guard.
    const keyStr: string = key;
    let lastUnderscoreIndex = keyStr.lastIndexOf('_');
    while (lastUnderscoreIndex > 0) {
        const possibleKey = keyStr.slice(0, lastUnderscoreIndex + 1);
        if (isCollectionKey(possibleKey)) {
            // Cache for future O(1) lookups
            memberToCollectionKeyMap.set(key, possibleKey);
            return possibleKey;
        }
        lastUnderscoreIndex = keyStr.lastIndexOf('_', lastUnderscoreIndex - 1);
    }

    return undefined;
}

/**
 * Pre-computes and caches the member → collection key mapping for a given key.
 * Called from OnyxCache.addKey() to ensure the Map stays populated.
 */
function registerMemberKey(key: OnyxKey): void {
    const existingCollectionKey = memberToCollectionKeyMap.get(key);
    if (existingCollectionKey !== undefined) {
        // Already in reverse map — ensure forward map is also populated.
        // getCollectionKey() can populate memberToCollectionKeyMap without
        // updating collectionToMembersMap, so we must sync here.
        let members = collectionToMembersMap.get(existingCollectionKey);
        if (!members) {
            members = new Set();
            collectionToMembersMap.set(existingCollectionKey, members);
        }
        members.add(key);
        return;
    }
    for (const collectionKey of collectionKeySet) {
        if (isCollectionMemberKey(collectionKey, key)) {
            memberToCollectionKeyMap.set(key, collectionKey);

            // Also register in the forward lookup (collection → members)
            let members = collectionToMembersMap.get(collectionKey);
            if (!members) {
                members = new Set();
                collectionToMembersMap.set(collectionKey, members);
            }
            members.add(key);
            return;
        }
    }
}

/**
 * Removes a member key from the reverse lookup map.
 * Called when a key is dropped from cache.
 */
function deregisterMemberKey(key: OnyxKey): void {
    const collectionKey = memberToCollectionKeyMap.get(key);
    if (collectionKey) {
        const members = collectionToMembersMap.get(collectionKey);
        if (members) {
            members.delete(key);
            if (members.size === 0) {
                collectionToMembersMap.delete(collectionKey);
            }
        }
    }
    memberToCollectionKeyMap.delete(key);
}

/**
 * Returns the set of member keys for a given collection key.
 * O(1) lookup using the forward index.
 */
function getMembersOfCollection(collectionKey: OnyxKey): Set<OnyxKey> | undefined {
    return collectionToMembersMap.get(collectionKey);
}

/**
 * Splits a collection member key into the collection key part and the ID part.
 *
 * @param key - The collection member key to split
 * @param collectionKey - Optional pre-resolved collection key for optimization
 * @returns A tuple of [collectionKey, memberId]
 * @throws If the key is not a valid collection member key
 */
function splitCollectionMemberKey<TKey extends CollectionKey, CollectionKeyType = TKey extends `${infer Prefix}_${string}` ? `${Prefix}_` : never>(
    key: TKey,
    collectionKey?: string,
): [CollectionKeyType, string] {
    if (collectionKey && !isCollectionMemberKey(collectionKey, key)) {
        throw new Error(`Invalid '${collectionKey}' collection key provided, it isn't compatible with '${key}' key.`);
    }

    if (!collectionKey) {
        const resolvedKey = getCollectionKey(key);
        if (!resolvedKey) {
            throw new Error(`Invalid '${key}' key provided, only collection keys are allowed.`);
        }
        // eslint-disable-next-line no-param-reassign
        collectionKey = resolvedKey;
    }

    return [collectionKey as CollectionKeyType, key.slice(collectionKey.length)];
}

/**
 * Initializes the RAM-only key set. Called once during Onyx.init().
 */
function setRamOnlyKeys(keys: Set<OnyxKey>): void {
    ramOnlyKeySet = keys;
}

/**
 * Checks if a given key is a RAM-only key, RAM-only collection key, or a RAM-only collection member.
 *
 * For example, given ramOnlyKeys: ["ramOnlyKey", "ramOnlyCollection_"]:
 * - isRamOnlyKey("ramOnlyKey") → true
 * - isRamOnlyKey("ramOnlyCollection_") → true
 * - isRamOnlyKey("ramOnlyCollection_1") → true
 * - isRamOnlyKey("someOtherKey") → false
 */
function isRamOnlyKey(key: OnyxKey): boolean {
    const collectionKey = getCollectionKey(key);
    if (collectionKey) {
        return ramOnlyKeySet.has(collectionKey);
    }
    return ramOnlyKeySet.has(key);
}

export default {
    setCollectionKeys,
    getCollectionKeys,
    isCollectionKey,
    isCollectionMemberKey,
    isCollectionMember,
    isKeyMatch,
    getCollectionKey,
    registerMemberKey,
    deregisterMemberKey,
    getMembersOfCollection,
    splitCollectionMemberKey,
    setRamOnlyKeys,
    isRamOnlyKey,
};
