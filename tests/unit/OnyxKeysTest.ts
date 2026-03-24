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
                test_: ['test_', ''],
                test_level_: ['test_level_', ''],
                test_level_1: ['test_level_', '1'],
                test_level_2: ['test_level_', '2'],
                test_level_last_3: ['test_level_last_', '3'],
                test___FAKE__: ['test_', '__FAKE__'],
                'test_-1_something': ['test_', '-1_something'],
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
            expect(OnyxKeys.isCollectionMember('test_123')).toBe(true);
            expect(OnyxKeys.isCollectionMember('test_level_456')).toBe(true);
            expect(OnyxKeys.isCollectionMember('test_level_last_789')).toBe(true);
            expect(OnyxKeys.isCollectionMember('test_-1_something')).toBe(true);
            expect(OnyxKeys.isCollectionMember('routes_abc')).toBe(true);
        });

        it('should return false for collection keys themselves', () => {
            expect(OnyxKeys.isCollectionMember('test_')).toBe(false);
            expect(OnyxKeys.isCollectionMember('test_level_')).toBe(false);
            expect(OnyxKeys.isCollectionMember('test_level_last_')).toBe(false);
            expect(OnyxKeys.isCollectionMember('routes_')).toBe(false);
        });

        it('should return false for non-collection keys', () => {
            expect(OnyxKeys.isCollectionMember('test')).toBe(false);
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
