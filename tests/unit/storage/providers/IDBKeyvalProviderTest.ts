import IDB from 'idb-keyval';
import IDBKeyValProvider from '../../../../lib/storage/providers/IDBKeyValProvider';
import utils from '../../../../lib/utils';
import type {GenericDeepRecord} from '../../../types';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    TEST_KEY_3: 'test3',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_KEY_2: 'test2_',
    },
};

describe('IDBKeyValProvider', () => {
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

    beforeEach(async () => {
        IDBKeyValProvider.init();
        await IDB.clear(IDBKeyValProvider.store);
    });

    describe('getItem', () => {
        it('should return the stored value for the key', async () => {
            await IDB.set(ONYXKEYS.TEST_KEY, 'value', IDBKeyValProvider.store);
            expect(await IDBKeyValProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual('value');
        });

        it('should return null if there is no stored value for the key', async () => {
            expect(await IDBKeyValProvider.getItem(ONYXKEYS.TEST_KEY)).toBeNull();
        });
    });

    describe('multiGet', () => {
        it('should return the tuples in the order of the keys supplied in a batch', async () => {
            await IDB.setMany(testEntries, IDBKeyValProvider.store);

            expect(await IDBKeyValProvider.multiGet([`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_2])).toEqual([
                testEntries[3],
                testEntries[0],
                testEntries[1],
            ]);
        });
    });

    describe('setItem', () => {
        it('should set the value to the key', async () => {
            await IDBKeyValProvider.setItem(ONYXKEYS.TEST_KEY, 'value');
            expect(await IDB.get(ONYXKEYS.TEST_KEY, IDBKeyValProvider.store)).toEqual('value');
        });

        it.skip('should remove the key when passing null', async () => {
            await IDBKeyValProvider.setItem(ONYXKEYS.TEST_KEY, 'value');
            expect(await IDB.get(ONYXKEYS.TEST_KEY, IDBKeyValProvider.store)).toEqual('value');

            await IDBKeyValProvider.setItem(ONYXKEYS.TEST_KEY, null);
            expect(await IDB.keys(IDBKeyValProvider.store)).not.toContainEqual(ONYXKEYS.TEST_KEY);
        });
    });

    describe('multiSet', () => {
        it('should set multiple keys in a batch', async () => {
            await IDBKeyValProvider.multiSet(testEntries);
            expect(
                await IDB.getMany(
                    testEntries.map((e) => e[0]),
                    IDBKeyValProvider.store,
                ),
            ).toEqual(testEntries.map((e) => (e[1] === null ? undefined : e[1])));
        });

        it('should set and remove multiple keys in a batch', async () => {
            await IDB.setMany(testEntries, IDBKeyValProvider.store);
            const changedEntries: Array<[string, unknown]> = [
                [ONYXKEYS.TEST_KEY, 'value_changed'],
                [ONYXKEYS.TEST_KEY_2, null],
                [ONYXKEYS.TEST_KEY_3, {changed: true}],
                [`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, null],
            ];

            await IDBKeyValProvider.multiSet(changedEntries);
            // ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_3 and `${ONYXKEYS.COLLECTION.TEST_KEY}id2`.
            expect((await IDB.keys(IDBKeyValProvider.store)).length).toEqual(3);
            expect(
                await IDB.getMany(
                    changedEntries.map((e) => e[0]),
                    IDBKeyValProvider.store,
                ),
            ).toEqual(changedEntries.map((e) => (e[1] === null ? undefined : e[1])));
        });
    });

    describe('multiMerge', () => {
        it('should merge multiple keys in a batch', async () => {
            await IDB.setMany(testEntries, IDBKeyValProvider.store);
            const changedEntries: Array<[string, unknown]> = [
                // FIXME: 🐞 IDBKeyValProvider (possibly other places): Primitives are incorrectly stored when using multiMerge
                // [ONYXKEYS.TEST_KEY, 'value_changed'],
                // [ONYXKEYS.TEST_KEY_2, 1001],
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
                ],
                // FIXME: 🐞 IDBKeyValProvider (possibly other places): Primitives are incorrectly stored when using multiMerge
                // [`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, false],
                [`${ONYXKEYS.COLLECTION.TEST_KEY}id2`, ['a', {newKey: 'newValue'}]],
            ];

            const expectedEntries = structuredClone(changedEntries);
            const expectedTestKey3Value = structuredClone(testEntries[2])[1] as GenericDeepRecord;
            expectedTestKey3Value.key = 'value_changed';
            expectedTestKey3Value.property.nestedProperty = {nestedKey2: 'nestedValue2_changed'};
            expectedTestKey3Value.property.newKey = 'newValue';
            expectedEntries[0][1] = expectedTestKey3Value;

            await IDBKeyValProvider.multiMerge(changedEntries);
            expect(
                await IDB.getMany(
                    expectedEntries.map((e) => e[0]),
                    IDBKeyValProvider.store,
                ),
            ).toEqual(expectedEntries.map((e) => (e[1] === null ? undefined : e[1])));
        });

        // FIXME: 🐞 IDBKeyValProvider - multiMerge calls multiple removeItem's instead of using the transaction
        // FIXME: 🐞 IDBKeyValProvider: Index misalignment between pairs and values in multiMerge
        // FIXME: Check if multiMerge is supposed to handle null values
        it.skip('should merge and delete multiple keys in a batch', async () => {
            await IDB.setMany(testEntries, IDBKeyValProvider.store);
            const changedEntries: Array<[string, unknown]> = [
                [ONYXKEYS.TEST_KEY, null],
                [ONYXKEYS.TEST_KEY_2, null],
                [ONYXKEYS.TEST_KEY_3, {key: 'value_changed'}],
                [`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, null],
                [`${ONYXKEYS.COLLECTION.TEST_KEY}id2`, ['a', {newKey: 'newValue'}]],
            ];

            const expectedEntries = structuredClone(changedEntries);
            const expectedTestKey3Value = structuredClone(testEntries[2])[1] as GenericDeepRecord;
            expectedTestKey3Value.key = 'value_changed';
            expectedEntries[2][1] = expectedTestKey3Value;

            await IDBKeyValProvider.multiMerge(changedEntries);
            // ONYXKEYS.TEST_KEY_3 and `${ONYXKEYS.COLLECTION.TEST_KEY}id2`.
            expect((await IDB.keys(IDBKeyValProvider.store)).length).toEqual(2);
            expect(
                await IDB.getMany(
                    expectedEntries.map((e) => e[0]),
                    IDBKeyValProvider.store,
                ),
            ).toEqual(expectedEntries.map((e) => (e[1] === null ? undefined : e[1])));
        });
    });

    describe('mergeItem', () => {
        it('should merge all the supported kinds of data correctly', async () => {
            await IDB.set(ONYXKEYS.TEST_KEY, 'value', IDBKeyValProvider.store);
            await IDB.set(ONYXKEYS.TEST_KEY_2, 1000, IDBKeyValProvider.store);
            await IDB.set(ONYXKEYS.TEST_KEY_3, {key: 'value', property: {propertyKey: 'propertyValue'}}, IDBKeyValProvider.store);
            await IDB.set(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, true, IDBKeyValProvider.store);
            await IDB.set(`${ONYXKEYS.COLLECTION.TEST_KEY}id2`, ['a', {key: 'value'}, 1, true], IDBKeyValProvider.store);

            await IDBKeyValProvider.mergeItem(ONYXKEYS.TEST_KEY, 'value_changed');
            await IDBKeyValProvider.mergeItem(ONYXKEYS.TEST_KEY_2, 1001);
            await IDBKeyValProvider.mergeItem(ONYXKEYS.TEST_KEY_3, {
                key: 'value_changed',
                property: {
                    [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                    newKey: 'newValue',
                },
            });
            await IDBKeyValProvider.mergeItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id1` as string, false);
            await IDBKeyValProvider.mergeItem(`${ONYXKEYS.COLLECTION.TEST_KEY}id2` as string, ['a', {newKey: 'newValue'}]);

            // FIXME: 🐞 IDBKeyValProvider (possibly other places): Primitives are incorrectly stored when using multiMerge
            // expect(await IDB.get(ONYXKEYS.TEST_KEY, IDBKeyValProvider.store)).toEqual('value_changed');
            // expect(await IDB.get(ONYXKEYS.TEST_KEY_2, IDBKeyValProvider.store)).toEqual(1001);
            expect(await IDB.get(ONYXKEYS.TEST_KEY_3, IDBKeyValProvider.store)).toEqual({key: 'value_changed', property: {newKey: 'newValue'}});
            // expect(await IDB.get(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, IDBKeyValProvider.store)).toEqual(false);
            expect(await IDB.get(`${ONYXKEYS.COLLECTION.TEST_KEY}id2`, IDBKeyValProvider.store)).toEqual(['a', {newKey: 'newValue'}]);
        });

        // FIXME: Check if multiMerge is supposed to handle null values
        it('should remove the key when passing null', async () => {
            await IDB.set(ONYXKEYS.TEST_KEY, 'value', IDBKeyValProvider.store);

            await IDBKeyValProvider.mergeItem(ONYXKEYS.TEST_KEY, null);
            expect(await IDB.keys(IDBKeyValProvider.store)).not.toContainEqual(ONYXKEYS.TEST_KEY);
        });
    });

    describe('getAllKeys', () => {
        it('should list all the keys stored', async () => {
            await IDB.setMany(testEntries, IDBKeyValProvider.store);
            expect((await IDBKeyValProvider.getAllKeys()).length).toEqual(5);
        });
    });

    describe('removeItem', () => {
        it('should remove the key from the store', async () => {
            await IDB.setMany(testEntries, IDBKeyValProvider.store);
            expect(await IDB.keys(IDBKeyValProvider.store)).toContainEqual(ONYXKEYS.TEST_KEY);

            await IDBKeyValProvider.removeItem(ONYXKEYS.TEST_KEY);
            expect(await IDB.keys(IDBKeyValProvider.store)).not.toContainEqual(ONYXKEYS.TEST_KEY);
        });
    });

    describe('removeItem', () => {
        it('should remove all the supplied keys from the store', async () => {
            await IDB.setMany(testEntries, IDBKeyValProvider.store);
            expect(await IDB.keys(IDBKeyValProvider.store)).toContainEqual(ONYXKEYS.TEST_KEY);
            expect(await IDB.keys(IDBKeyValProvider.store)).toContainEqual(ONYXKEYS.TEST_KEY_3);

            await IDBKeyValProvider.removeItems([ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_3]);
            expect(await IDB.keys(IDBKeyValProvider.store)).not.toContainEqual(ONYXKEYS.TEST_KEY);
            expect(await IDB.keys(IDBKeyValProvider.store)).not.toContainEqual(ONYXKEYS.TEST_KEY_3);
        });
    });

    describe('clear', () => {
        it('should clear the storage', async () => {
            await IDB.setMany(testEntries, IDBKeyValProvider.store);
            expect((await IDB.keys(IDBKeyValProvider.store)).length).toEqual(5);

            await IDBKeyValProvider.clear();
            expect((await IDB.keys(IDBKeyValProvider.store)).length).toEqual(0);
        });
    });

    describe('getDatabaseSize', () => {
        beforeEach(() => {
            Object.defineProperty(window.navigator, 'storage', {
                value: {
                    estimate: jest.fn().mockResolvedValue({quota: 750000, usage: 250000}),
                },
                configurable: true,
            });
        });

        afterEach(() => {
            // @ts-expect-error tear down of mocked property
            delete window.navigator.storage;
        });

        it('should get the current size of the store', async () => {
            expect(await IDBKeyValProvider.getDatabaseSize()).toEqual({
                bytesUsed: 250000,
                bytesRemaining: 500000,
            });
        });
    });
});
