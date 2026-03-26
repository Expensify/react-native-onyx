import Onyx from '../../lib';
import OnyxKeys from '../../lib/OnyxKeys';

const ONYXKEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_LEVEL_KEY: 'test_level_',
        TEST_LEVEL_LAST_KEY: 'test_level_last_',
        ROUTES: 'routes_',
        RAM_ONLY_COLLECTION: 'ramOnlyCollection_',
    },
    RAM_ONLY_KEY: 'ramOnlyKey',
};

describe('OnyxKeys', () => {
    beforeAll(() =>
        Onyx.init({
            keys: ONYXKEYS,
            ramOnlyKeys: [ONYXKEYS.RAM_ONLY_KEY, ONYXKEYS.COLLECTION.RAM_ONLY_COLLECTION],
        }),
    );

    beforeEach(() => Onyx.clear());

    afterEach(() => jest.clearAllMocks());

    describe('splitCollectionMemberKey', () => {
        describe('should return correct values', () => {
            const dataResult: Record<string, [string, string]> = {
                // Collection key with no member ID
                test_: ['test_', ''],
                // Nested collection key with no member ID
                test_level_: ['test_level_', ''],
                // Nested collection keys with member IDs
                test_level_1: ['test_level_', '1'],
                test_level_2: ['test_level_', '2'],
                // Deeply nested collection member key, matches longest prefix
                test_level_last_3: ['test_level_last_', '3'],
                // Underscores in the ID portion, only the first matching prefix is the collection key
                test___FAKE__: ['test_', '__FAKE__'],
                // Negative/compound IDs, the collection is 'test_', everything after is the ID
                'test_-1_something': ['test_', '-1_something'],
                // Nested collection with compound ID, 'test_level_' is the longest matching collection
                'test_level_-1_something': ['test_level_', '-1_something'],
            };

            it.each(Object.keys(dataResult))('%s', (key) => {
                const [collectionKey, id] = OnyxKeys.splitCollectionMemberKey(key);
                expect(collectionKey).toEqual(dataResult[key][0]);
                expect(id).toEqual(dataResult[key][1]);
            });
        });

        it('should throw error if key does not contain underscore', () => {
            expect(() => {
                OnyxKeys.splitCollectionMemberKey(ONYXKEYS.TEST_KEY);
            }).toThrow("Invalid 'test' key provided, only collection keys are allowed.");
            expect(() => {
                OnyxKeys.splitCollectionMemberKey('');
            }).toThrow("Invalid '' key provided, only collection keys are allowed.");
        });

        it('should allow passing the collection key beforehand for performance gains', () => {
            const [collectionKey, id] = OnyxKeys.splitCollectionMemberKey(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.COLLECTION.TEST_KEY);
            expect(collectionKey).toEqual(ONYXKEYS.COLLECTION.TEST_KEY);
            expect(id).toEqual('id1');
        });

        it("should throw error if the passed collection key isn't compatible with the key", () => {
            expect(() => {
                OnyxKeys.splitCollectionMemberKey(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.COLLECTION.TEST_LEVEL_KEY);
            }).toThrow("Invalid 'test_level_' collection key provided, it isn't compatible with 'test_id1' key.");
        });
    });

    describe('getCollectionKey', () => {
        describe('should return correct values', () => {
            const dataResult: Record<string, string> = {
                test_: 'test_',
                test_level_: 'test_level_',
                test_level_1: 'test_level_',
                test_level_2: 'test_level_',
                test_level_last_3: 'test_level_last_',
                test___FAKE__: 'test_',
                'test_-1_something': 'test_',
                'test_level_-1_something': 'test_level_',
            };

            it.each(Object.keys(dataResult))('%s', (key) => {
                const collectionKey = OnyxKeys.getCollectionKey(key);
                expect(collectionKey).toEqual(dataResult[key]);
            });
        });

        it('should return undefined if key does not contain underscore', () => {
            expect(OnyxKeys.getCollectionKey(ONYXKEYS.TEST_KEY)).toBeUndefined();
            expect(OnyxKeys.getCollectionKey('')).toBeUndefined();
        });
    });

    describe('isCollectionMember', () => {
        it('should return true for collection member keys', () => {
            expect(OnyxKeys.isCollectionMember(`${ONYXKEYS.COLLECTION.TEST_KEY}123`)).toBe(true);
            expect(OnyxKeys.isCollectionMember(`${ONYXKEYS.COLLECTION.TEST_LEVEL_KEY}456`)).toBe(true);
            expect(OnyxKeys.isCollectionMember(`${ONYXKEYS.COLLECTION.TEST_LEVEL_LAST_KEY}789`)).toBe(true);
            expect(OnyxKeys.isCollectionMember(`${ONYXKEYS.COLLECTION.TEST_KEY}-1_something`)).toBe(true);
            expect(OnyxKeys.isCollectionMember(`${ONYXKEYS.COLLECTION.ROUTES}abc`)).toBe(true);
        });

        it('should return false for collection keys themselves', () => {
            expect(OnyxKeys.isCollectionMember(ONYXKEYS.COLLECTION.TEST_KEY)).toBe(false);
            expect(OnyxKeys.isCollectionMember(ONYXKEYS.COLLECTION.TEST_LEVEL_KEY)).toBe(false);
            expect(OnyxKeys.isCollectionMember(ONYXKEYS.COLLECTION.TEST_LEVEL_LAST_KEY)).toBe(false);
            expect(OnyxKeys.isCollectionMember(ONYXKEYS.COLLECTION.ROUTES)).toBe(false);
        });

        it('should return false for non-collection keys', () => {
            expect(OnyxKeys.isCollectionMember(ONYXKEYS.TEST_KEY)).toBe(false);
            expect(OnyxKeys.isCollectionMember('someRegularKey')).toBe(false);
            expect(OnyxKeys.isCollectionMember('notACollection')).toBe(false);
            expect(OnyxKeys.isCollectionMember('')).toBe(false);
        });

        it('should return false for invalid keys', () => {
            expect(OnyxKeys.isCollectionMember('invalid_key_123')).toBe(false);
            expect(OnyxKeys.isCollectionMember('notregistered_')).toBe(false);
            expect(OnyxKeys.isCollectionMember('notregistered_123')).toBe(false);
        });
    });

    describe('isCollectionKey', () => {
        it('should return true for registered collection keys', () => {
            expect(OnyxKeys.isCollectionKey(ONYXKEYS.COLLECTION.TEST_KEY)).toBe(true);
            expect(OnyxKeys.isCollectionKey(ONYXKEYS.COLLECTION.TEST_LEVEL_KEY)).toBe(true);
            expect(OnyxKeys.isCollectionKey(ONYXKEYS.COLLECTION.ROUTES)).toBe(true);
        });

        it('should return false for non-collection keys', () => {
            expect(OnyxKeys.isCollectionKey(ONYXKEYS.TEST_KEY)).toBe(false);
            expect(OnyxKeys.isCollectionKey('')).toBe(false);
        });

        it('should return false for collection member keys', () => {
            expect(OnyxKeys.isCollectionKey(`${ONYXKEYS.COLLECTION.TEST_KEY}123`)).toBe(false);
            expect(OnyxKeys.isCollectionKey(`${ONYXKEYS.COLLECTION.ROUTES}abc`)).toBe(false);
        });
    });

    describe('isCollectionMemberKey', () => {
        it('should return true when key starts with collection key and is longer', () => {
            expect(OnyxKeys.isCollectionMemberKey(ONYXKEYS.COLLECTION.TEST_KEY, `${ONYXKEYS.COLLECTION.TEST_KEY}123`)).toBe(true);
            expect(OnyxKeys.isCollectionMemberKey(ONYXKEYS.COLLECTION.TEST_LEVEL_KEY, `${ONYXKEYS.COLLECTION.TEST_LEVEL_KEY}456`)).toBe(true);
            expect(OnyxKeys.isCollectionMemberKey(ONYXKEYS.COLLECTION.ROUTES, `${ONYXKEYS.COLLECTION.ROUTES}abc`)).toBe(true);
        });

        it('should return false when key equals the collection key exactly', () => {
            expect(OnyxKeys.isCollectionMemberKey(ONYXKEYS.COLLECTION.TEST_KEY, ONYXKEYS.COLLECTION.TEST_KEY)).toBe(false);
            expect(OnyxKeys.isCollectionMemberKey(ONYXKEYS.COLLECTION.ROUTES, ONYXKEYS.COLLECTION.ROUTES)).toBe(false);
        });

        it('should return false when key does not start with collection key', () => {
            expect(OnyxKeys.isCollectionMemberKey(ONYXKEYS.COLLECTION.TEST_KEY, `${ONYXKEYS.COLLECTION.ROUTES}123`)).toBe(false);
            expect(OnyxKeys.isCollectionMemberKey(ONYXKEYS.COLLECTION.TEST_LEVEL_KEY, `${ONYXKEYS.COLLECTION.TEST_KEY}123`)).toBe(false);
        });
    });

    describe('isKeyMatch', () => {
        it('should match exact non-collection keys', () => {
            expect(OnyxKeys.isKeyMatch(ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY)).toBe(true);
        });

        it('should not match different non-collection keys', () => {
            expect(OnyxKeys.isKeyMatch(ONYXKEYS.TEST_KEY, ONYXKEYS.RAM_ONLY_KEY)).toBe(false);
        });

        it('should match collection key as prefix of member key', () => {
            expect(OnyxKeys.isKeyMatch(ONYXKEYS.COLLECTION.TEST_KEY, `${ONYXKEYS.COLLECTION.TEST_KEY}123`)).toBe(true);
            expect(OnyxKeys.isKeyMatch(ONYXKEYS.COLLECTION.ROUTES, `${ONYXKEYS.COLLECTION.ROUTES}abc`)).toBe(true);
        });

        it('should match collection key against itself', () => {
            expect(OnyxKeys.isKeyMatch(ONYXKEYS.COLLECTION.TEST_KEY, ONYXKEYS.COLLECTION.TEST_KEY)).toBe(true);
        });

        it('should not match collection key against unrelated key', () => {
            expect(OnyxKeys.isKeyMatch(ONYXKEYS.COLLECTION.TEST_KEY, `${ONYXKEYS.COLLECTION.ROUTES}123`)).toBe(false);
        });
    });

    describe('getCollectionKeys', () => {
        it('should return the set of registered collection keys', () => {
            const keys = OnyxKeys.getCollectionKeys();
            expect(keys.has(ONYXKEYS.COLLECTION.TEST_KEY)).toBe(true);
            expect(keys.has(ONYXKEYS.COLLECTION.ROUTES)).toBe(true);
            expect(keys.has(ONYXKEYS.COLLECTION.RAM_ONLY_COLLECTION)).toBe(true);
        });

        it('should not contain non-collection keys', () => {
            const keys = OnyxKeys.getCollectionKeys();
            expect(keys.has(ONYXKEYS.TEST_KEY)).toBe(false);
            expect(keys.has(ONYXKEYS.RAM_ONLY_KEY)).toBe(false);
        });
    });

    describe('registerMemberKey / deregisterMemberKey / getMembersOfCollection', () => {
        it('should register a member key and make it retrievable via getMembersOfCollection', () => {
            const memberKey = `${ONYXKEYS.COLLECTION.TEST_KEY}newKey1`;
            OnyxKeys.registerMemberKey(memberKey);

            const members = OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.TEST_KEY);
            expect(members).toBeDefined();
            expect(members?.has(memberKey)).toBe(true);

            // Clean up
            OnyxKeys.deregisterMemberKey(memberKey);
        });

        it('should resolve to the most specific (longest) collection key for overlapping prefixes', () => {
            // 'test_level_' and 'test_' both match 'test_level_1', but 'test_level_' is more specific
            const memberKey = `${ONYXKEYS.COLLECTION.TEST_LEVEL_KEY}1`;
            OnyxKeys.registerMemberKey(memberKey);

            expect(OnyxKeys.getCollectionKey(memberKey)).toBe(ONYXKEYS.COLLECTION.TEST_LEVEL_KEY);

            const testLevelMembers = OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.TEST_LEVEL_KEY);
            expect(testLevelMembers?.has(memberKey)).toBe(true);

            // Should NOT be registered under the shorter 'test_' collection
            const testMembers = OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.TEST_KEY);
            expect(testMembers?.has(memberKey)).toBeFalsy();

            // Clean up
            OnyxKeys.deregisterMemberKey(memberKey);
        });

        it('should populate the reverse lookup so getCollectionKey returns O(1)', () => {
            const memberKey = `${ONYXKEYS.COLLECTION.ROUTES}xyz`;
            OnyxKeys.registerMemberKey(memberKey);

            expect(OnyxKeys.getCollectionKey(memberKey)).toBe(ONYXKEYS.COLLECTION.ROUTES);

            // Clean up
            OnyxKeys.deregisterMemberKey(memberKey);
        });

        it('should not register keys that do not belong to any collection', () => {
            OnyxKeys.registerMemberKey('unknownKey');

            expect(OnyxKeys.getCollectionKey('unknownKey')).toBeUndefined();
            expect(OnyxKeys.getMembersOfCollection('unknownKey')).toBeUndefined();
        });

        it('should deregister a member key from both forward and reverse maps', () => {
            const memberKey = `${ONYXKEYS.COLLECTION.TEST_KEY}toRemove`;
            OnyxKeys.registerMemberKey(memberKey);
            expect(OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.TEST_KEY)?.has(memberKey)).toBe(true);

            OnyxKeys.deregisterMemberKey(memberKey);
            expect(OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.TEST_KEY)?.has(memberKey)).toBeFalsy();
        });

        it('should handle registering the same key twice without duplicates', () => {
            const memberKey = `${ONYXKEYS.COLLECTION.TEST_KEY}duplicate`;
            OnyxKeys.registerMemberKey(memberKey);
            OnyxKeys.registerMemberKey(memberKey);

            const members = OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.TEST_KEY);
            const count = Array.from(members ?? []).filter((k) => k === memberKey).length;
            expect(count).toBe(1);

            // Clean up
            OnyxKeys.deregisterMemberKey(memberKey);
        });

        it('should register multiple members and return all via getMembersOfCollection', () => {
            const key1 = `${ONYXKEYS.COLLECTION.ROUTES}a`;
            const key2 = `${ONYXKEYS.COLLECTION.ROUTES}b`;
            const key3 = `${ONYXKEYS.COLLECTION.ROUTES}c`;

            OnyxKeys.registerMemberKey(key1);
            OnyxKeys.registerMemberKey(key2);
            OnyxKeys.registerMemberKey(key3);

            const members = OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.ROUTES);
            expect(members).toBeDefined();
            expect(members?.size).toBe(3);
            expect(members?.has(key1)).toBe(true);
            expect(members?.has(key2)).toBe(true);
            expect(members?.has(key3)).toBe(true);

            // Clean up
            OnyxKeys.deregisterMemberKey(key1);
            OnyxKeys.deregisterMemberKey(key2);
            OnyxKeys.deregisterMemberKey(key3);
        });

        it('should only remove the deregistered member and keep the rest', () => {
            const key1 = `${ONYXKEYS.COLLECTION.ROUTES}keep1`;
            const key2 = `${ONYXKEYS.COLLECTION.ROUTES}remove`;
            const key3 = `${ONYXKEYS.COLLECTION.ROUTES}keep2`;

            OnyxKeys.registerMemberKey(key1);
            OnyxKeys.registerMemberKey(key2);
            OnyxKeys.registerMemberKey(key3);

            OnyxKeys.deregisterMemberKey(key2);

            const members = OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.ROUTES);
            expect(members?.size).toBe(2);
            expect(members?.has(key1)).toBe(true);
            expect(members?.has(key2)).toBe(false);
            expect(members?.has(key3)).toBe(true);

            // Clean up
            OnyxKeys.deregisterMemberKey(key1);
            OnyxKeys.deregisterMemberKey(key3);
        });

        it('should track members across different collections independently', () => {
            const testKey = `${ONYXKEYS.COLLECTION.TEST_KEY}member1`;
            const routeKey = `${ONYXKEYS.COLLECTION.ROUTES}member1`;

            OnyxKeys.registerMemberKey(testKey);
            OnyxKeys.registerMemberKey(routeKey);

            const testMembers = OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.TEST_KEY);
            const routeMembers = OnyxKeys.getMembersOfCollection(ONYXKEYS.COLLECTION.ROUTES);

            expect(testMembers?.size).toBe(1);
            expect(testMembers?.has(testKey)).toBe(true);
            expect(testMembers?.has(routeKey)).toBe(false);
            expect(routeMembers?.size).toBe(1);
            expect(routeMembers?.has(routeKey)).toBe(true);
            expect(routeMembers?.has(testKey)).toBe(false);

            // Clean up
            OnyxKeys.deregisterMemberKey(testKey);
            OnyxKeys.deregisterMemberKey(routeKey);
        });

        it('should handle deregistering a key that was never registered', () => {
            expect(() => {
                OnyxKeys.deregisterMemberKey(`${ONYXKEYS.COLLECTION.TEST_KEY}neverRegistered`);
            }).not.toThrow();
        });
    });

    describe('isRamOnlyKey', () => {
        it('should return true for RAM-only key', () => {
            expect(OnyxKeys.isRamOnlyKey(ONYXKEYS.RAM_ONLY_KEY)).toBeTruthy();
        });

        it('should return true for RAM-only collection', () => {
            expect(OnyxKeys.isRamOnlyKey(ONYXKEYS.COLLECTION.RAM_ONLY_COLLECTION)).toBeTruthy();
        });

        it('should return true for RAM-only collection member', () => {
            expect(OnyxKeys.isRamOnlyKey(`${ONYXKEYS.COLLECTION.RAM_ONLY_COLLECTION}1`)).toBeTruthy();
        });

        it('should return false for a normal key', () => {
            expect(OnyxKeys.isRamOnlyKey(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });

        it('should return false for normal collection', () => {
            expect(OnyxKeys.isRamOnlyKey(ONYXKEYS.COLLECTION.TEST_KEY)).toBeFalsy();
        });

        it('should return false for normal collection member', () => {
            expect(OnyxKeys.isRamOnlyKey(`${ONYXKEYS.COLLECTION.TEST_KEY}1`)).toBeFalsy();
        });
    });
});
