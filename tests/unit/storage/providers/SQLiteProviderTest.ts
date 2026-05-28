/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Integration test for `SQLiteProvider` using a Node-side SQLite engine.
 *
 * Pattern mirrors `IDBKeyvalProviderTest.ts` — real provider code + real
 * SQLite engine (via better-sqlite3) standing in for `react-native-nitro-sqlite`.
 */
// Hoisted by Jest before any imports → overrides the global jestSetup.js mock.
jest.mock('react-native-nitro-sqlite', () => require('../../mocks/sqliteMock'));
jest.mock('react-native-device-info', () => ({getFreeDiskStorage: () => 12345}));

import SQLiteProvider from '../../../../lib/storage/providers/SQLiteProvider';
import utils from '../../../../lib/utils';

const mock = require('../../mocks/sqliteMock');

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    TEST_KEY_3: 'test3',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

describe('SQLiteProvider', () => {
    beforeEach(() => {
        mock.__resetAllDatabases();
        SQLiteProvider.init();
    });

    afterAll(() => {
        mock.__resetAllDatabases();
    });

    describe('setItem / getItem', () => {
        it('round-trips a primitive', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'value');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual('value');
        });

        it('returns null for a missing key', async () => {
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBeNull();
        });

        it('round-trips a nested object', async () => {
            const value = {a: 1, nested: {b: [1, 2, 3], c: null}};
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_3, value);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)).toEqual(value);
        });
    });

    describe('multiSet / multiGet', () => {
        it('writes multiple keys and reads them back in order', async () => {
            await SQLiteProvider.multiSet([
                [ONYXKEYS.TEST_KEY, 'value'],
                [ONYXKEYS.TEST_KEY_2, 1000],
                [ONYXKEYS.TEST_KEY_3, {x: 1}],
            ]);
            const out = await SQLiteProvider.multiGet([ONYXKEYS.TEST_KEY_2, ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_3]);
            expect(out).toEqual(
                expect.arrayContaining([
                    [ONYXKEYS.TEST_KEY, 'value'],
                    [ONYXKEYS.TEST_KEY_2, 1000],
                    [ONYXKEYS.TEST_KEY_3, {x: 1}],
                ]),
            );
            expect(out).toHaveLength(3);
        });

        it('treats undefined as null (regression for SQLiteProvider line 124)', async () => {
            await SQLiteProvider.multiSet([[ONYXKEYS.TEST_KEY, undefined as unknown as null]]);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBeNull();
        });
    });

    describe('multiMerge — JSON_PATCH semantics', () => {
        it('shallow-merges existing record_key value', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_3, {a: 1, b: 2});
            await SQLiteProvider.multiMerge([[ONYXKEYS.TEST_KEY_3, {b: 99, c: 3}]]);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)).toEqual({a: 1, b: 99, c: 3});
        });

        it('deep-merges nested objects', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_3, {
                outer: {a: 1, b: 2, nested: {x: 1, y: 2}},
            });
            await SQLiteProvider.multiMerge([[ONYXKEYS.TEST_KEY_3, {outer: {b: 99, nested: {y: 99, z: 3}}}]]);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_3)).toEqual({
                outer: {a: 1, b: 99, nested: {x: 1, y: 99, z: 3}},
            });
        });

        it('inserts a new record when key does not exist', async () => {
            await SQLiteProvider.multiMerge([[ONYXKEYS.TEST_KEY_2, {fresh: true}]]);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_2)).toEqual({fresh: true});
        });
    });

    describe('multiMerge — JSON_REPLACE semantics (replaceNullPatches)', () => {
        it('fully replaces a nested object marked with REPLACE_OBJECT_MARK', async () => {
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

    describe('removeItem / removeItems (IN-list)', () => {
        it('removes a single key', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'v');
            await SQLiteProvider.removeItem(ONYXKEYS.TEST_KEY);
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBeNull();
        });

        it('removes a batch via IN-list', async () => {
            await SQLiteProvider.multiSet([
                [ONYXKEYS.TEST_KEY, 1],
                [ONYXKEYS.TEST_KEY_2, 2],
                [ONYXKEYS.TEST_KEY_3, 3],
            ]);
            await SQLiteProvider.removeItems([ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_3]);
            const keys = await SQLiteProvider.getAllKeys();
            expect(keys).toEqual([ONYXKEYS.TEST_KEY_2]);
        });
    });

    describe('SQL-injection safety', () => {
        it('treats a key containing SQL fragments as a literal record_key', async () => {
            const nastyKey = "'; DROP TABLE keyvaluepairs; --";
            await SQLiteProvider.setItem(nastyKey, 'survived');
            // If the placeholder weren't parameterised, the table would be gone here.
            expect(await SQLiteProvider.getItem(nastyKey)).toEqual('survived');
            expect(await SQLiteProvider.getAllKeys()).toEqual([nastyKey]);
        });
    });

    describe('getDatabaseSize', () => {
        it('returns positive bytesUsed after a write', async () => {
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, {payload: 'x'.repeat(1024)});
            const size = await SQLiteProvider.getDatabaseSize();
            expect(size.bytesUsed).toBeGreaterThan(0);
            // bytesRemaining comes from the mocked getFreeDiskStorage(): 12345
            expect(size.bytesRemaining).toBe(12345);
        });
    });

    describe('clear', () => {
        it('empties the table', async () => {
            await SQLiteProvider.multiSet([
                [ONYXKEYS.TEST_KEY, 1],
                [ONYXKEYS.TEST_KEY_2, 2],
            ]);
            await SQLiteProvider.clear();
            expect(await SQLiteProvider.getAllKeys()).toEqual([]);
        });
    });
});
