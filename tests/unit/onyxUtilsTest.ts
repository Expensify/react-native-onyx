import Onyx from '../../lib';
import OnyxUtils from '../../lib/OnyxUtils';
import type {DeepRecord} from '../../lib/types';
import utils from '../../lib/utils';

const ONYXKEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_LEVEL_KEY: 'test_level_',
        TEST_LEVEL_LAST_KEY: 'test_level_last_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());

describe('OnyxUtils', () => {
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
                const [collectionKey, id] = OnyxUtils.splitCollectionMemberKey(key);
                expect(collectionKey).toEqual(dataResult[key][0]);
                expect(id).toEqual(dataResult[key][1]);
            });
        });

        it('should throw error if key does not contain underscore', () => {
            expect(() => {
                OnyxUtils.splitCollectionMemberKey(ONYXKEYS.TEST_KEY);
            }).toThrowError("Invalid 'test' key provided, only collection keys are allowed.");
            expect(() => {
                OnyxUtils.splitCollectionMemberKey('');
            }).toThrowError("Invalid '' key provided, only collection keys are allowed.");
        });

        it('should allow passing the collection key beforehand for performance gains', () => {
            const [collectionKey, id] = OnyxUtils.splitCollectionMemberKey(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.COLLECTION.TEST_KEY);
            expect(collectionKey).toEqual(ONYXKEYS.COLLECTION.TEST_KEY);
            expect(id).toEqual('id1');
        });

        it("should throw error if the passed collection key isn't compatible with the key", () => {
            expect(() => {
                OnyxUtils.splitCollectionMemberKey(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.COLLECTION.TEST_LEVEL_KEY);
            }).toThrowError("Invalid 'test_level_' collection key provided, it isn't compatible with 'test_id1' key.");
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
                const collectionKey = OnyxUtils.getCollectionKey(key);
                expect(collectionKey).toEqual(dataResult[key]);
            });
        });

        it('should throw error if key does not contain underscore', () => {
            expect(() => {
                OnyxUtils.getCollectionKey(ONYXKEYS.TEST_KEY);
            }).toThrowError("Invalid 'test' key provided, only collection keys are allowed.");
            expect(() => {
                OnyxUtils.getCollectionKey('');
            }).toThrowError("Invalid '' key provided, only collection keys are allowed.");
        });
    });

    describe('applyMerge', () => {
        const testObject: DeepRecord<string, unknown> = {
            a: 'a',
            b: {
                c: 'c',
                d: {
                    e: 'e',
                    f: 'f',
                },
                g: 'g',
            },
        };

        const testMergeChanges: Array<DeepRecord<string, unknown>> = [
            {
                b: {
                    d: {
                        h: 'h',
                    },
                },
            },
            {
                b: {
                    d: null,
                    h: 'h',
                },
            },
            {
                b: {
                    d: {
                        i: 'i',
                    },
                },
            },
            {
                b: {
                    d: null,
                    g: null,
                },
            },
            {
                b: {
                    d: {
                        i: 'i',
                        j: 'j',
                    },
                    g: {
                        k: 'k',
                    },
                },
            },
        ];

        it("should return the last change if it's an array", () => {
            const result = OnyxUtils.applyMerge(testObject, [...testMergeChanges, [0, 1, 2]], false, false, true);

            expect(result).toEqual([0, 1, 2]);
        });

        it("should return the last change if the changes aren't objects", () => {
            const result = OnyxUtils.applyMerge(testObject, ['a', 0, 'b', 1], false, false, true);

            expect(result).toEqual(1);
        });

        it('should merge data correctly when batching merge changes', () => {
            const result = OnyxUtils.applyMerge(undefined, testMergeChanges, false, true, false);

            expect(result).toEqual({
                b: {
                    d: {
                        i: 'i',
                        j: 'j',
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                    },
                    h: 'h',
                    g: {
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                        k: 'k',
                    },
                },
            });
        });

        it('should merge data correctly when applying batched changes', () => {
            const batchedChanges: DeepRecord<string, unknown> = {
                b: {
                    d: {
                        i: 'i',
                        j: 'j',
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                    },
                    h: 'h',
                    g: {
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                        k: 'k',
                    },
                },
            };

            const result = OnyxUtils.applyMerge(testObject, [batchedChanges], false, false, true);

            expect(result).toEqual({
                a: 'a',
                b: {
                    c: 'c',
                    d: {
                        i: 'i',
                        j: 'j',
                    },
                    h: 'h',
                    g: {
                        k: 'k',
                    },
                },
            });
        });
    });
});
