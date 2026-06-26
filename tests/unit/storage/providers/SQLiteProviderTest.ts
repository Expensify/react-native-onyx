/**
 * Integration test for `SQLiteProvider` using a Node-side SQLite engine.
 *
 * Pattern mirrors `IDBKeyvalProviderTest.ts` — real provider code + real
 * SQLite engine (via better-sqlite3) standing in for `react-native-nitro-sqlite`.
 */
import SQLiteProvider from '../../../../lib/storage/providers/SQLiteProvider';
import utils from '../../../../lib/utils';
import type {GenericDeepRecord} from '../../../types';
import {resetAllDatabases} from '../../mocks/sqliteMock';

// `jest.mock` is hoisted by Jest above the imports — register the SQLite mock
// (overriding the global jestSetup.js mock) and a tiny device-info stub.
jest.mock('react-native-nitro-sqlite', () => require('../../mocks/sqliteMock'));
jest.mock('react-native-device-info', () => ({getFreeDiskStorage: () => 12345}));

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    TEST_KEY_3: 'test3',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_KEY_2: 'test2_',
    },
};

describe('SQLiteProvider', () => {
    const testEntries: Array<[string, unknown]> = [
        [ONYXKEYS.TEST_KEY, 'value'],
        [ONYXKEYS.TEST_KEY_2, 1000],
        [
            ONYXKEYS.TEST_KEY_3,
            {
                key: 'value',
                property: {
                    nestedProperty: {
                        nestedKey1: 'nestedValue1',
                        nestedKey2: 'nestedValue2',
                    },
                },
            },
        ],
        [`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, true],
        [`${ONYXKEYS.COLLECTION.TEST_KEY}id2`, ['a', {key: 'value'}, 1, true]],
    ];

    beforeEach(() => {
        resetAllDatabases();
        SQLiteProvider.init();
    });

    afterAll(() => {
        resetAllDatabases();
    });

    describe('getItem', () => {
        it('should return the stored value for the key', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'value');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual('value');
        });

        it('should return null if there is no stored value for the key', async () => {
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBeNull();
        });
    });

    describe('multiGet', () => {
        // SQLite's `WHERE record_key IN (...)` does not preserve the input order
        // (rows come back in primary-key order). IDB's getMany() does. So this
        // test mirrors the IDB one but asserts membership rather than order.
        it('should return the tuples for the keys supplied in a batch', async () => {
            await SQLiteProvider.multiSet(testEntries);
            const out = await SQLiteProvider.multiGet([`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_2]);
            expect(out).toEqual(expect.arrayContaining([testEntries.at(3), testEntries.at(0), testEntries.at(1)]));
            expect(out).toHaveLength(3);
        });
    });

    describe('setItem', () => {
        it('should set the value to the key', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'value');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual('value');
        });

        // SQLiteProvider stores `null` in valueJSON instead of deleting the row
        // (unlike IDB, which removes the key). Callers wanting deletion call
        // `removeItem` directly.
        it('should store null when passing null', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'value');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual('value');

            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, null);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBeNull();
        });
    });

    describe('multiSet', () => {
        it('should set multiple keys in a batch', async () => {
            await SQLiteProvider.multiSet(testEntries);

            const out = await SQLiteProvider.multiGet(testEntries.map((e) => e[0]));
            const sortedActual = out.sort((a, b) => a[0].localeCompare(b[0]));
            const sortedExpected = [...testEntries].sort((a, b) => a[0].localeCompare(b[0]));
            expect(sortedActual).toEqual(sortedExpected);
        });

        // IDB's equivalent test asserts that null entries delete the key. SQLite
        // stores the null value in place. See note on `setItem` null behavior.
        it('should set and null-out multiple keys in a batch', async () => {
            await SQLiteProvider.multiSet(testEntries);
            const changedEntries: Array<[string, unknown]> = [
                [ONYXKEYS.TEST_KEY, 'value_changed'],
                [ONYXKEYS.TEST_KEY_2, null],
                [ONYXKEYS.TEST_KEY_3, {changed: true}],
                [`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, null],
            ];

            await SQLiteProvider.multiSet(changedEntries);

            const out = await SQLiteProvider.multiGet(changedEntries.map((e) => e[0]));
            const sortedActual = out.sort((a, b) => a[0].localeCompare(b[0]));
            const sortedExpected = [...changedEntries].sort((a, b) => a[0].localeCompare(b[0]));
            expect(sortedActual).toEqual(sortedExpected);
        });

        // SQLite-specific regression: `multiSet` substitutes null for undefined
        // before serializing, otherwise JSON.stringify(undefined) === undefined
        // and the row would store a literal "undefined" string.
        it('treats undefined as null', async () => {
            await SQLiteProvider.multiSet([[ONYXKEYS.TEST_KEY, undefined]]);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBeNull();
        });
    });

    describe('multiMerge', () => {
        it('should merge multiple keys in a batch', async () => {
            await SQLiteProvider.multiSet(testEntries);
            const changedEntries: Array<[string, unknown, Array<[string[], unknown]>?]> = [
                [ONYXKEYS.TEST_KEY, 'value_changed'],
                [ONYXKEYS.TEST_KEY_2, 1001],
                [
                    ONYXKEYS.TEST_KEY_3,
                    {
                        key: 'value_changed',
                        property: {
                            nestedProperty: {
                                nestedKey2: 'nestedValue2_changed',
                                [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                            },
                            newKey: 'newValue',
                        },
                    },
                    // The mark above signals `property.nestedProperty` is replaced wholesale.
                    [[['property', 'nestedProperty'], {nestedKey2: 'nestedValue2_changed'}]],
                ],
                [`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, false],
                [`${ONYXKEYS.COLLECTION.TEST_KEY}id2`, ['a', {newKey: 'newValue'}]],
            ];

            const expectedTestKey3Value = structuredClone(testEntries.at(2))[1] as GenericDeepRecord;
            expectedTestKey3Value.key = 'value_changed';
            expectedTestKey3Value.property.nestedProperty = {nestedKey2: 'nestedValue2_changed'};
            expectedTestKey3Value.property.newKey = 'newValue';

            await SQLiteProvider.multiMerge(changedEntries);

            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual('value_changed');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_2)).toEqual(1001);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)).toEqual(expectedTestKey3Value);
            expect(await SQLiteProvider.getItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`)).toEqual(false);
            expect(await SQLiteProvider.getItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id2`)).toEqual(['a', {newKey: 'newValue'}]);
        });

        it('should insert a new record when key does not exist', async () => {
            await SQLiteProvider.multiMerge([[ONYXKEYS.TEST_KEY_2, {fresh: true}]]);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_2)).toEqual({fresh: true});
        });

        it('should shallow-merge existing record_key value', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_3, {a: 1, b: 2});
            await SQLiteProvider.multiMerge([[ONYXKEYS.TEST_KEY_3, {b: 99, c: 3}]]);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)).toEqual({a: 1, b: 99, c: 3});
        });

        it('should deep-merge nested objects', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_3, {
                outer: {a: 1, b: 2, nested: {x: 1, y: 2}},
            });
            await SQLiteProvider.multiMerge([[ONYXKEYS.TEST_KEY_3, {outer: {b: 99, nested: {y: 99, z: 3}}}]]);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)).toEqual({
                outer: {a: 1, b: 99, nested: {x: 1, y: 99, z: 3}},
            });
        });

        // RFC 7396 (JSON Merge Patch): a `null` value in the patch removes the key
        // from the target. SQLite's `JSON_PATCH` implements this directly.
        it('deletes top-level and nested keys when the merge value is null', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_3, {
                keepMe: 'still here',
                removeMe: 'gone soon',
                outer: {keepInner: 1, removeInner: 2, deeper: {keepDeep: 'a', removeDeep: 'b'}},
            });

            await SQLiteProvider.multiMerge([
                [
                    ONYXKEYS.TEST_KEY_3,
                    {
                        removeMe: null,
                        outer: {removeInner: null, deeper: {removeDeep: null}},
                    },
                ],
            ]);

            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)).toEqual({
                keepMe: 'still here',
                outer: {keepInner: 1, deeper: {keepDeep: 'a'}},
            });
        });

        // SQLite-specific: the JSON_REPLACE path is what makes `REPLACE_OBJECT_MARK`
        // actually wipe a nested object (JSON_PATCH alone would only merge into it).
        it('should fully replace a nested object marked with REPLACE_OBJECT_MARK via JSON_REPLACE', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_3, {
                outer: {a: 1, b: 2, nested: {keepMe: false, oldKey: 'gone'}},
            });

            // Onyx flow: caller (utils.fastMerge) produces a `change` already merged
            // plus a list of `replaceNullPatches` describing which nested objects
            // should be wholesale replaced via JSON_REPLACE.
            const change = {
                outer: {
                    nested: {
                        // The mark is filtered out by SQLiteProvider's `objectMarkRemover`
                        // before the value is stringified.
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                        newKey: 'newValue',
                    },
                },
            };
            const replaceNullPatches: Array<[string[], unknown]> = [[['outer', 'nested'], {newKey: 'newValue'}]];

            await SQLiteProvider.multiMerge([[ONYXKEYS.TEST_KEY_3, change, replaceNullPatches]]);

            const stored = (await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)) as Record<string, unknown>;
            expect(stored).toEqual({
                outer: {a: 1, b: 2, nested: {newKey: 'newValue'}},
            });
            // Crucially: oldKey/keepMe should be gone (replace, not merge).
            expect((stored.outer as Record<string, unknown>).nested).not.toHaveProperty('oldKey');
            expect((stored.outer as Record<string, unknown>).nested).not.toHaveProperty('keepMe');
        });
    });

    describe('mergeItem', () => {
        it('should merge all the supported kinds of data correctly', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'value');
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_2, 1000);
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_3, {key: 'value', property: {propertyKey: 'propertyValue'}});
            await SQLiteProvider.setItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, true);
            await SQLiteProvider.setItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id2`, ['a', {key: 'value'}, 1, true]);

            await SQLiteProvider.mergeItem(ONYXKEYS.TEST_KEY, 'value_changed');
            await SQLiteProvider.mergeItem(ONYXKEYS.TEST_KEY_2, 1001);
            await SQLiteProvider.mergeItem(
                ONYXKEYS.TEST_KEY_3,
                {
                    key: 'value_changed',
                    property: {
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                        newKey: 'newValue',
                    },
                },
                [[['property'], {newKey: 'newValue'}]],
            );
            await SQLiteProvider.mergeItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, false);
            await SQLiteProvider.mergeItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id2`, ['a', {newKey: 'newValue'}]);

            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual('value_changed');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_2)).toEqual(1001);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)).toEqual({key: 'value_changed', property: {newKey: 'newValue'}});
            expect(await SQLiteProvider.getItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`)).toEqual(false);
            expect(await SQLiteProvider.getItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id2`)).toEqual(['a', {newKey: 'newValue'}]);
        });
    });

    describe('getAllKeys', () => {
        it('should list all the keys stored', async () => {
            await SQLiteProvider.multiSet(testEntries);
            expect((await SQLiteProvider.getAllKeys()).length).toEqual(5);
        });
    });

    describe('removeItem', () => {
        it('should remove the key from the store', async () => {
            await SQLiteProvider.multiSet(testEntries);
            expect(await SQLiteProvider.getAllKeys()).toContain(ONYXKEYS.TEST_KEY);

            await SQLiteProvider.removeItem(ONYXKEYS.TEST_KEY);
            expect(await SQLiteProvider.getAllKeys()).not.toContain(ONYXKEYS.TEST_KEY);
        });
    });

    describe('removeItems', () => {
        it('should remove all the supplied keys from the store', async () => {
            await SQLiteProvider.multiSet(testEntries);
            expect(await SQLiteProvider.getAllKeys()).toContain(ONYXKEYS.TEST_KEY);
            expect(await SQLiteProvider.getAllKeys()).toContain(ONYXKEYS.TEST_KEY_3);

            await SQLiteProvider.removeItems([ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_3]);
            expect(await SQLiteProvider.getAllKeys()).not.toContain(ONYXKEYS.TEST_KEY);
            expect(await SQLiteProvider.getAllKeys()).not.toContain(ONYXKEYS.TEST_KEY_3);
        });
    });

    // SQLite-specific: the IN-list is parameterised, so a key containing SQL
    // fragments must be treated as a literal record_key.
    describe('SQL-injection safety', () => {
        it('should treat a key containing SQL fragments as a literal record_key', async () => {
            const nastyKey = "'; DROP TABLE keyvaluepairs; --";
            await SQLiteProvider.setItem(nastyKey, 'survived');
            expect(await SQLiteProvider.getItem(nastyKey)).toEqual('survived');
            expect(await SQLiteProvider.getAllKeys()).toEqual([nastyKey]);
        });
    });

    describe('clear', () => {
        it('should clear the storage', async () => {
            await SQLiteProvider.multiSet(testEntries);
            expect((await SQLiteProvider.getAllKeys()).length).toEqual(5);

            await SQLiteProvider.clear();
            expect((await SQLiteProvider.getAllKeys()).length).toEqual(0);
        });
    });

    describe('getDatabaseSize', () => {
        it('should report a larger bytesUsed after a write', async () => {
            // SQLite allocates pages on init (table + WAL), so bytesUsed is non-0 from the
            // start; assert that a write increases it rather than comparing to 0.
            const before = await SQLiteProvider.getDatabaseSize();
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, {payload: 'x'.repeat(64 * 1024)});
            const after = await SQLiteProvider.getDatabaseSize();

            expect(after.bytesUsed).toBeGreaterThan(before.bytesUsed);
        });
    });
});
