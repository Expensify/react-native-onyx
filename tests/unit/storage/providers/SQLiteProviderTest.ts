/**
 * Integration test for `SQLiteProvider` using NitroSQLite's Node mock.
 */
import {open} from 'react-native-nitro-sqlite';
import type {NitroSQLiteConnection, PreparedStatement} from 'react-native-nitro-sqlite';
import SQLiteProvider from '../../../../lib/storage/providers/SQLiteProvider';
import utils from '../../../../lib/utils';
import type {GenericDeepRecord} from '../../../types';
// Jest resolves the package export, which TypeScript's legacy Node resolution cannot resolve.
const {resetAllDatabases} = jest.requireActual<{resetAllDatabases: () => void}>('react-native-nitro-sqlite/mock');

// Override the global native stub with NitroSQLite's mock.
jest.mock('react-native-nitro-sqlite', () => {
    const sqliteMock = jest.requireActual<{open: (options: Parameters<typeof open>[0]) => Pick<NitroSQLiteConnection, 'prepare'>}>('react-native-nitro-sqlite/mock');
    return {
        ...sqliteMock,
        open: jest.fn((options: Parameters<typeof open>[0]) => {
            const connection = sqliteMock.open(options);
            jest.spyOn(connection, 'prepare');
            return connection;
        }),
    };
});
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
        jest.mocked(open).mockClear();
        SQLiteProvider.init();
    });

    afterAll(() => {
        resetAllDatabases();
    });

    describe('NitroSQLite 10 connections and statements', () => {
        it('opens a separate read-only connection after configuring the writer', () => {
            expect(jest.mocked(open).mock.calls).toEqual([[{name: 'OnyxDB'}], [{name: 'OnyxDB', connection: 'independent', readOnly: true}]]);
        });

        it('reuses prepared statements for repeated single-key operations', async () => {
            const writerPrepare = jest.mocked(getOpenedConnection(0).prepare);
            const readerPrepare = jest.mocked(getOpenedConnection(1).prepare);
            expect(writerPrepare).toHaveBeenCalledTimes(2);
            expect(readerPrepare).toHaveBeenCalledTimes(1);

            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'first');
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY_2, 'second');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBe('first');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY_2)).toBe('second');
            await SQLiteProvider.removeItem(ONYXKEYS.TEST_KEY);

            expect(writerPrepare).toHaveBeenCalledTimes(2);
            expect(readerPrepare).toHaveBeenCalledTimes(1);
        });

        it('waits for an already queued write before reading on the independent connection', async () => {
            let releaseWrite: () => void = () => undefined;
            const writeGate = new Promise<void>((resolve) => {
                releaseWrite = resolve;
            });
            const setItemStatement = getPreparedStatement(getOpenedConnection(0), 0);
            const executeWrite = setItemStatement.executeAsync.bind(setItemStatement);
            jest.spyOn(setItemStatement, 'executeAsync').mockImplementationOnce(async (params) => {
                await writeGate;
                return executeWrite(params);
            });
            const executeRead = jest.spyOn(getPreparedStatement(getOpenedConnection(1), 0), 'executeAsync');

            const write = SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'committed');
            const read = SQLiteProvider.getItem(ONYXKEYS.TEST_KEY);

            await Promise.resolve();
            expect(executeRead).not.toHaveBeenCalled();

            releaseWrite();
            await write;
            expect(await read).toBe('committed');
        });

        it('does not block later reads after a failed write', async () => {
            await expect(SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, undefined as unknown as null)).rejects.toThrow();
            await expect(SQLiteProvider.getAllKeys()).resolves.toEqual([]);
        });
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
            await SQLiteProvider.multiSet(testEntries as Array<[string, unknown]>);
            const out = await SQLiteProvider.multiGet([`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_2]);
            expect(out).toEqual(expect.arrayContaining([testEntries[3], testEntries[0], testEntries[1]]));
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

        it('rolls back all grouped writes when a later parameter set fails', async () => {
            // Given a constraint that rejects the second insert in a grouped batch.
            SQLiteProvider.store!.execute(`CREATE TRIGGER reject_insert BEFORE INSERT ON keyvaluepairs
                WHEN NEW.record_key = '${ONYXKEYS.TEST_KEY_2}' BEGIN SELECT RAISE(ABORT, 'rejected insert'); END;`);

            // When the first insert succeeds but the second one is rejected.
            await expect(
                SQLiteProvider.multiSet([
                    [ONYXKEYS.TEST_KEY, 'first'],
                    [ONYXKEYS.TEST_KEY_2, 'second'],
                ]),
            ).rejects.toThrow('rejected insert');

            // Then the batch is atomic and its failure does not block subsequent reads or writes.
            expect(await SQLiteProvider.getAllKeys()).toEqual([]);
            await SQLiteProvider.setItem(ONYXKEYS.TEST_KEY, 'recovered');
            expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBe('recovered');
        });

        // SQLite-specific regression: `multiSet` substitutes null for undefined
        // before serializing, otherwise JSON.stringify(undefined) === undefined
        // and the row would store a literal "undefined" string.
        it('treats undefined as null', async () => {
            await SQLiteProvider.multiSet([[ONYXKEYS.TEST_KEY, undefined as unknown as null]]);
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

            const expectedTestKey3Value = structuredClone(testEntries[2])[1] as GenericDeepRecord;
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
            await SQLiteProvider.setItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id1` as string, true);
            await SQLiteProvider.setItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id2` as string, ['a', {key: 'value'}, 1, true]);

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
            await SQLiteProvider.mergeItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id1` as string, false);
            await SQLiteProvider.mergeItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id2` as string, ['a', {newKey: 'newValue'}]);

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

    describe('getAll', () => {
        it('should return every stored key-value pair with correct values', async () => {
            await SQLiteProvider.multiSet(testEntries);

            const out = await SQLiteProvider.getAll();
            const sortedActual = [...out].sort((a, b) => a[0].localeCompare(b[0]));
            const sortedExpected = [...testEntries].sort((a, b) => a[0].localeCompare(b[0]));

            expect(out).toHaveLength(5);
            expect(sortedActual).toEqual(sortedExpected);
        });

        it('should return an empty array when the store is empty', async () => {
            expect(await SQLiteProvider.getAll()).toEqual([]);
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

    describe('query splitting', () => {
        const CHUNK_SIZE = 2;
        const originalChunkArray = utils.chunkArray;

        const createKeyValueEntries = (count: number): Array<[string, unknown]> => Array.from({length: count}, (_, index) => [`chunk_key_${index}`, index]);

        beforeEach(() => {
            resetAllDatabases();
            jest.mocked(open).mockClear();
            SQLiteProvider.init();

            jest.spyOn(utils, 'chunkArray').mockImplementation((items, _maxChunkSize) => originalChunkArray(items, CHUNK_SIZE));
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        describe('multiGet', () => {
            it('should return all values when keys exceed MAX_VARIABLE_NUMBER', async () => {
                const entries = createKeyValueEntries(5);
                await SQLiteProvider.multiSet(entries);

                const keys = entries.map(([key]) => key);
                const result = await SQLiteProvider.multiGet(keys);

                expect(result).toEqual(expect.arrayContaining(entries));
                expect(result).toHaveLength(entries.length);
            });

            it('should issue one IN query per chunk', async () => {
                const entries = createKeyValueEntries(5);
                await SQLiteProvider.multiSet(entries);

                const reader = getOpenedConnection(1);
                const transaction = reader.transaction.bind(reader);
                const queries: string[] = [];
                jest.spyOn(reader, 'transaction').mockImplementation((callback) =>
                    transaction((tx) => {
                        const executeAsync = tx.executeAsync.bind(tx);
                        jest.spyOn(tx, 'executeAsync').mockImplementation((query, params) => {
                            queries.push(query);
                            return executeAsync(query, params);
                        });
                        return callback(tx);
                    }),
                );

                const keys = entries.map(([key]) => key);
                await SQLiteProvider.multiGet(keys);

                const inQueries = queries.filter((query) => query.includes('WHERE record_key IN'));
                expect(inQueries).toHaveLength(3);
            });

            it('releases a failed snapshot transaction before the next read', async () => {
                // Given several chunks and a query failure inside the read transaction.
                const entries = createKeyValueEntries(5);
                await SQLiteProvider.multiSet(entries);
                const reader = getOpenedConnection(1);
                const transaction = reader.transaction.bind(reader);
                jest.spyOn(reader, 'transaction').mockImplementationOnce((callback) =>
                    transaction((tx) => {
                        const executeAsync = tx.executeAsync.bind(tx);
                        let queryCount = 0;
                        jest.spyOn(tx, 'executeAsync').mockImplementation((query, params) => {
                            if (++queryCount === 2) {
                                return Promise.reject(new Error('failed snapshot query'));
                            }
                            return executeAsync(query, params);
                        });
                        return callback(tx);
                    }),
                );
                const keys = entries.map(([key]) => key);

                // When one chunk fails, the original error reaches the caller.
                await expect(SQLiteProvider.multiGet(keys)).rejects.toThrow('failed snapshot query');

                // Then rollback releases the reader and the next snapshot returns all values.
                await expect(SQLiteProvider.multiGet(keys)).resolves.toEqual(expect.arrayContaining(entries));
            });

            it('reads all chunks from one snapshot while another connection writes', async () => {
                const entries = createKeyValueEntries(5);
                await SQLiteProvider.multiSet(entries);

                let releaseRead: () => void = () => undefined;
                const readGate = new Promise<void>((resolve) => {
                    releaseRead = resolve;
                });
                let firstReadCompleted: () => void = () => undefined;
                const firstRead = new Promise<void>((resolve) => {
                    firstReadCompleted = resolve;
                });
                const reader = getOpenedConnection(1);
                const transaction = reader.transaction.bind(reader);
                jest.spyOn(reader, 'transaction').mockImplementation((callback) =>
                    transaction((tx) => {
                        const executeAsync = tx.executeAsync.bind(tx);
                        let queryCount = 0;
                        jest.spyOn(tx, 'executeAsync').mockImplementation(async (query, params) => {
                            const isFirstQuery = queryCount++ === 0;
                            if (!isFirstQuery) {
                                await readGate;
                            }
                            const result = await executeAsync(query, params);
                            if (isFirstQuery) {
                                firstReadCompleted();
                            }
                            return result;
                        });
                        return callback(tx);
                    }),
                );

                const keys = entries.map(([key]) => key);
                const read = SQLiteProvider.multiGet(keys);
                await firstRead;

                await SQLiteProvider.setItem(keys[2], 99);
                releaseRead();

                expect(await read).toContainEqual([keys[2], 2]);
                expect(await SQLiteProvider.getItem(keys[2])).toBe(99);
            });
        });

        describe('removeItems', () => {
            it('should remove all keys when keys exceed MAX_VARIABLE_NUMBER', async () => {
                const entries = createKeyValueEntries(5);
                await SQLiteProvider.multiSet(entries);

                const keys = entries.map(([key]) => key);
                await SQLiteProvider.removeItems(keys);

                expect(await SQLiteProvider.getAllKeys()).toEqual([]);
            });

            it('removes every key when all grouped chunks have the same size', async () => {
                // Given an exact number of full chunks and a key outside the removal list.
                const entries = createKeyValueEntries(6);
                await SQLiteProvider.multiSet([...entries, [ONYXKEYS.TEST_KEY, 'keep']]);

                // When all full chunks run through the same batch statement.
                await SQLiteProvider.removeItems(entries.map(([key]) => key));

                // Then every requested key is gone and unrelated data remains.
                expect(await SQLiteProvider.getAllKeys()).toEqual([ONYXKEYS.TEST_KEY]);
                expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toBe('keep');
            });

            it('rolls back earlier chunks when a later grouped delete fails', async () => {
                // Given a trigger that rejects a key in the second full chunk.
                const entries = createKeyValueEntries(5);
                await SQLiteProvider.multiSet(entries);
                SQLiteProvider.store!.execute(`CREATE TRIGGER reject_delete BEFORE DELETE ON keyvaluepairs
                    WHEN OLD.record_key = '${entries[2][0]}' BEGIN SELECT RAISE(ABORT, 'rejected delete'); END;`);
                const keys = entries.map(([key]) => key);

                // When a later delete fails after the first chunk has executed.
                await expect(SQLiteProvider.removeItems(keys)).rejects.toThrow('rejected delete');

                // Then the entire batch rolls back and the writer remains usable.
                expect(await SQLiteProvider.multiGet(keys)).toEqual(expect.arrayContaining(entries));
                SQLiteProvider.store!.execute('DROP TRIGGER reject_delete;');
                await SQLiteProvider.removeItems(keys);
                expect(await SQLiteProvider.getAllKeys()).toEqual([]);
            });

            it('should use executeAsync when keys fit in a single chunk', async () => {
                const entries = createKeyValueEntries(2);
                await SQLiteProvider.multiSet(entries);

                const executeAsyncSpy = jest.spyOn(SQLiteProvider.store!, 'executeAsync');
                const executeBatchAsyncSpy = jest.spyOn(SQLiteProvider.store!, 'executeBatchAsync');
                executeAsyncSpy.mockClear();
                executeBatchAsyncSpy.mockClear();

                const keys = entries.map(([key]) => key);
                await SQLiteProvider.removeItems(keys);

                expect(executeAsyncSpy).toHaveBeenCalledTimes(1);
                expect(executeBatchAsyncSpy).not.toHaveBeenCalled();
            });

            it('should use executeBatchAsync when keys span multiple chunks', async () => {
                const entries = createKeyValueEntries(5);
                await SQLiteProvider.multiSet(entries);

                const executeAsyncSpy = jest.spyOn(SQLiteProvider.store!, 'executeAsync');
                const executeBatchAsyncSpy = jest.spyOn(SQLiteProvider.store!, 'executeBatchAsync');
                executeAsyncSpy.mockClear();
                executeBatchAsyncSpy.mockClear();

                const keys = entries.map(([key]) => key);
                await SQLiteProvider.removeItems(keys);

                expect(executeAsyncSpy).not.toHaveBeenCalled();
                expect(executeBatchAsyncSpy).toHaveBeenCalledTimes(1);

                const batchCommands = executeBatchAsyncSpy.mock.calls[0][0];
                expect(batchCommands).toHaveLength(2);
                expect(batchCommands[0].params).toEqual([keys.slice(0, 2), keys.slice(2, 4)]);
                expect(batchCommands[1].params).toEqual(keys.slice(4));
                expect(batchCommands.every((command) => command.query.includes('DELETE FROM keyvaluepairs WHERE record_key IN'))).toBe(true);
                expect(await SQLiteProvider.getAllKeys()).toEqual([]);
            });
        });
    });

    // SQLite-specific: the IN-list is parameterised, so a key containing SQL
    // fragments must be treated as a literal record_key.
    describe('SQL-injection safety', () => {
        it('preserves embedded NUL characters in keys and JSON values', async () => {
            // Given a key with a NUL byte and a JSON value containing the same character.
            const key = 'nul\0key';
            const value = {text: 'before\0after'};

            // When both are stored through a grouped parameter set.
            await SQLiteProvider.multiSet([[key, value]]);

            // Then prepared reads, bulk reads, and exports retain the complete key and value.
            expect(await SQLiteProvider.getItem(key)).toEqual(value);
            expect(await SQLiteProvider.multiGet([key])).toEqual([[key, value]]);
            expect(await SQLiteProvider.getAllKeys()).toEqual([key]);
            expect(await SQLiteProvider.getAll()).toEqual([[key, value]]);
        });

        it('should treat a key containing SQL fragments as a literal record_key', async () => {
            const nastyKey = "'; DROP TABLE keyvaluepairs; --";
            await SQLiteProvider.setItem(nastyKey as string, 'survived');
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

        it('should still report free-disk bytes when the PRAGMAs fail (disk pressure)', async () => {
            // During disk pressure the SQLite connection itself fails, but free-disk comes from the
            // filesystem — the snapshot must survive with bytesUsed degraded instead of rejecting.
            const executeAsyncSpy = jest.spyOn(SQLiteProvider.store!, 'executeAsync').mockRejectedValue(new Error('[NativeNitroSQLiteException][SqlExecutionError] disk I/O error'));

            await expect(SQLiteProvider.getDatabaseSize()).resolves.toEqual({bytesUsed: -1, bytesRemaining: 12345});

            executeAsyncSpy.mockRestore();
        });
    });
});

function getOpenedConnection(index: number): NitroSQLiteConnection {
    const result = jest.mocked(open).mock.results[index];
    if (!result || result.type !== 'return') {
        throw new Error(`Connection ${index} was not opened`);
    }
    return result.value;
}

function getPreparedStatement(connection: NitroSQLiteConnection, index: number): PreparedStatement {
    const result = jest.mocked(connection.prepare).mock.results[index];
    if (!result || result.type !== 'return') {
        throw new Error(`Statement ${index} was not prepared`);
    }
    return result.value;
}
