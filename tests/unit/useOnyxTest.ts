import {act, renderHook} from '@testing-library/react-native';
import type {OnyxCollection, OnyxEntry, OnyxKey} from '../../lib';
import Onyx, {useOnyx} from '../../lib';
import OnyxCache from '../../lib/OnyxCache';
import StorageMock from '../../lib/storage';
import type GenericCollection from '../utils/GenericCollection';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import onyxSnapshotCache from '../../lib/OnyxSnapshotCache';
import type {UseOnyxSelector} from '../../lib/useOnyx';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_KEY_2: 'test2_',
        EVICTABLE_TEST_KEY: 'evictable_test_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
    evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
    skippableCollectionMemberIDs: ['skippable-id'],
});

beforeEach(async () => {
    await Onyx.clear();
    onyxSnapshotCache.clear();
    onyxSnapshotCache.clearSelectorIds();
});

describe('useOnyx', () => {
    describe('dynamic key', () => {
        const error = (key1: string, key2: string) =>
            `'${key1}' key can't be changed to '${key2}'. useOnyx() only supports dynamic keys if they are both collection member keys from the same collection e.g. from 'collection_id1' to 'collection_id2'.`;

        beforeEach(() => {
            jest.spyOn(console, 'error').mockImplementation(jest.fn);
        });

        afterEach(() => {
            (console.error as unknown as jest.SpyInstance<void, Parameters<typeof console.error>>).mockRestore();
        });

        it('should throw an error when changing from a non-collection key to another one', async () => {
            const {rerender} = renderHook((key: string) => useOnyx(key), {initialProps: ONYXKEYS.TEST_KEY});

            try {
                await act(async () => {
                    rerender(ONYXKEYS.TEST_KEY_2);
                });

                fail('Expected to throw an error.');
            } catch (e) {
                expect((e as Error).message).toBe(error(ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_2));
            }
        });

        it('should throw an error when changing from a collection key to another one', async () => {
            const {rerender} = renderHook((key: string) => useOnyx(key), {initialProps: ONYXKEYS.COLLECTION.TEST_KEY});

            try {
                await act(async () => {
                    rerender(ONYXKEYS.COLLECTION.TEST_KEY_2);
                });

                fail('Expected to throw an error.');
            } catch (e) {
                expect((e as Error).message).toBe(error(ONYXKEYS.COLLECTION.TEST_KEY, ONYXKEYS.COLLECTION.TEST_KEY_2));
            }
        });

        it('should throw an error when changing from a collection key to a collectiom member key', async () => {
            const {rerender} = renderHook((key: string) => useOnyx(key), {initialProps: ONYXKEYS.COLLECTION.TEST_KEY});

            try {
                await act(async () => {
                    rerender(`${ONYXKEYS.COLLECTION.TEST_KEY}1`);
                });

                fail('Expected to throw an error.');
            } catch (e) {
                expect((e as Error).message).toBe(error(ONYXKEYS.COLLECTION.TEST_KEY, `${ONYXKEYS.COLLECTION.TEST_KEY}1`));
            }
        });

        it('should not throw any errors when changing from a collection member key to another one', async () => {
            const {rerender} = renderHook((key: string) => useOnyx(key), {initialProps: `${ONYXKEYS.COLLECTION.TEST_KEY}1` as string});

            try {
                await act(async () => {
                    rerender(`${ONYXKEYS.COLLECTION.TEST_KEY}2`);
                });
            } catch (e) {
                fail("Expected to don't throw any errors.");
            }
        });

        it('should not throw an error when changing from a non-collection key to another one if allowDynamicKey is true', async () => {
            const {rerender} = renderHook((key: string) => useOnyx(key, {allowDynamicKey: true}), {initialProps: ONYXKEYS.TEST_KEY});

            try {
                await act(async () => {
                    rerender(ONYXKEYS.TEST_KEY_2);
                });
            } catch (e) {
                fail("Expected to don't throw any errors.");
            }
        });

        it('should throw an error when changing from a non-collection key to another one if allowDynamicKey is false', async () => {
            const {rerender} = renderHook((key: string) => useOnyx(key, {allowDynamicKey: false}), {initialProps: ONYXKEYS.TEST_KEY});

            try {
                await act(async () => {
                    rerender(ONYXKEYS.TEST_KEY_2);
                });

                fail('Expected to throw an error.');
            } catch (e) {
                expect((e as Error).message).toBe(error(ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_2));
            }
        });

        it('should not throw an error when changing from a collection member key to another one if allowDynamicKey is true', async () => {
            const {rerender} = renderHook((key: string) => useOnyx(key, {allowDynamicKey: true}), {initialProps: `${ONYXKEYS.COLLECTION.TEST_KEY}` as string});

            try {
                await act(async () => {
                    rerender(`${ONYXKEYS.COLLECTION.TEST_KEY_2}`);
                });
            } catch (e) {
                fail("Expected to don't throw any errors.");
            }
        });
    });

    describe('misc', () => {
        it('should initially return loading state while loading non-existent key, and then return `undefined` and loaded state', async () => {
            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should initially return loading state while loading non-existent collection key, and then return `undefined` and loaded state', async () => {
            const {result} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.TEST_KEY));

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return value and loaded state when loading cached key', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toEqual('test');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should initially return `undefined` while loading non-cached key, and then return value and loaded state', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('test');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should initially return undefined and then return cached value after multiple merge operations', async () => {
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test1');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test3');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('test3');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return value from cache, and return updated value after a merge operation', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test1');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toEqual('test1');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, 'test2'));

            expect(result.current[0]).toEqual('test2');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return loaded state after an Onyx.clear() call while connecting and loading from cache', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            Onyx.clear();

            const {result: result1} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));
            const {result: result2} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result1.current[0]).toBeUndefined();
            expect(result1.current[1].status).toEqual('loaded');
            expect(result2.current[0]).toBeUndefined();
            expect(result2.current[1].status).toEqual('loaded');

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toEqual('test2');
            expect(result1.current[1].status).toEqual('loaded');
            expect(result2.current[0]).toEqual('test2');
            expect(result2.current[1].status).toEqual('loaded');
        });

        it('should return updated state when connecting to the same regular key after an Onyx.clear() call', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const {result: result1} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toEqual('test');
            expect(result1.current[1].status).toEqual('loaded');

            await act(async () => Onyx.clear());

            const {result: result2} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));
            const {result: result3} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toBeUndefined();
            expect(result1.current[1].status).toEqual('loaded');
            expect(result2.current[0]).toBeUndefined();
            expect(result2.current[1].status).toEqual('loaded');
            expect(result3.current[0]).toBeUndefined();
            expect(result3.current[1].status).toEqual('loaded');

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toEqual('test2');
            expect(result1.current[1].status).toEqual('loaded');
            expect(result2.current[0]).toEqual('test2');
            expect(result2.current[1].status).toEqual('loaded');
            expect(result3.current[0]).toEqual('test2');
            expect(result3.current[1].status).toEqual('loaded');
        });

        it('should return updated state when connecting to the same colection member key after an Onyx.clear() call', async () => {
            await StorageMock.setItem<string>(`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`, 'test');

            const {result: result1} = renderHook(() => useOnyx(`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`));

            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toEqual('test');
            expect(result1.current[1].status).toEqual('loaded');

            await act(async () => Onyx.clear());

            const {result: result2} = renderHook(() => useOnyx(`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`));
            const {result: result3} = renderHook(() => useOnyx(`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`));

            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toBeUndefined();
            expect(result1.current[1].status).toEqual('loaded');
            expect(result2.current[0]).toBeUndefined();
            expect(result2.current[1].status).toEqual('loaded');
            expect(result3.current[0]).toBeUndefined();
            expect(result3.current[1].status).toEqual('loaded');

            Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`, 'test2');
            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toEqual('test2');
            expect(result1.current[1].status).toEqual('loaded');
            expect(result2.current[0]).toEqual('test2');
            expect(result2.current[1].status).toEqual('loaded');
            expect(result3.current[0]).toEqual('test2');
            expect(result3.current[1].status).toEqual('loaded');
        });
    });

    describe('selector', () => {
        it('should return selected data from a non-collection key', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, {id: 'test_id', name: 'test_name'});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{id: string; name: string}>) => `id - ${entry?.id}, name - ${entry?.name}`) as UseOnyxSelector<OnyxKey, string>,
                }),
            );

            expect(result.current[0]).toEqual('id - test_id, name - test_name');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {id: 'changed_id', name: 'changed_name'}));

            expect(result.current[0]).toEqual('id - changed_id, name - changed_name');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return selected data from a collection key', async () => {
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: {id: 'entry3_id', name: 'entry3_name'},
            } as GenericCollection);

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.COLLECTION.TEST_KEY, {
                    selector: ((entries: OnyxCollection<{id: string; name: string}>) =>
                        Object.entries(entries ?? {}).reduce<NonNullable<OnyxCollection<string>>>((acc, [key, value]) => {
                            acc[key] = value?.id;
                            return acc;
                        }, {})) as UseOnyxSelector<OnyxKey, NonNullable<OnyxCollection<string>>>,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: 'entry1_id',
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: 'entry2_id',
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: 'entry3_id',
            });
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`, null));

            expect(result.current[0]).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: 'entry1_id',
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: 'entry3_id',
            });
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should not change selected data if a property outside that data was changed', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, {id: 'test_id', name: 'test_name'});

            // primitive
            const {result: primitiveResult} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{id: string; name: string}>) => entry?.id) as UseOnyxSelector<OnyxKey, string>,
                }),
            );

            // object
            const {result: objectResult} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{id: string; name: string}>) => ({id: entry?.id})) as UseOnyxSelector<OnyxKey, {id?: string}>,
                }),
            );

            // array
            const {result: arrayResult} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{id: string; name: string}>) => [{id: entry?.id}]) as UseOnyxSelector<OnyxKey, Array<{id?: string}>>,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            const oldPrimitiveResult = primitiveResult.current;
            const oldObjectResult = objectResult.current;
            const oldArrayResult = arrayResult.current;

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {name: 'test_name_changed'}));

            // must be the same reference
            expect(oldPrimitiveResult).toBe(primitiveResult.current);
            expect(oldObjectResult).toBe(objectResult.current);
            expect(oldArrayResult).toBe(arrayResult.current);
        });

        it('should not change selected collection data if a property outside that data was changed', async () => {
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: {id: 'entry3_id', name: 'entry3_name'},
            } as GenericCollection);

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.COLLECTION.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{id: string; name: string}>) => ({id: entry?.id})) as UseOnyxSelector<OnyxKey, {id?: string}>,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            const oldResult = result.current;

            await act(async () => Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`, {name: 'entry2_changed'}));

            // must be the same reference
            expect(oldResult).toBe(result.current);
        });

        it('should always use the current selector reference to return new data', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, {id: 'test_id', name: 'test_name'});

            let selector = ((entry: OnyxEntry<{id: string; name: string}>) => `id - ${entry?.id}, name - ${entry?.name}`) as UseOnyxSelector<OnyxKey, string>;

            const {result, rerender} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector,
                }),
            );

            expect(result.current[0]).toEqual('id - test_id, name - test_name');
            expect(result.current[1].status).toEqual('loaded');

            selector = ((entry: OnyxEntry<{id: string; name: string}>) => `id - ${entry?.id}, name - ${entry?.name} - selector changed`) as UseOnyxSelector<OnyxKey, string>;
            rerender(undefined);

            expect(result.current[0]).toEqual('id - test_id, name - test_name - selector changed');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should memoize selector output and return same reference when input unchanged', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, {id: 'test_id', name: 'test_name', count: 1});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{id: string; name: string; count: number}>) => ({
                        id: entry?.id,
                        name: entry?.name,
                    })) as UseOnyxSelector<OnyxKey, {id?: string; name?: string}>,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            const firstResult = result.current[0];

            // Trigger another render without changing the data
            await act(async () => waitForPromisesToResolve());

            // Should return the exact same reference due to memoization
            expect(result.current[0]).toBe(firstResult);
        });

        it('should return new reference when selector input changes', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, {id: 'test_id', name: 'test_name'});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{id: string; name: string}>) => ({
                        id: entry?.id,
                        name: entry?.name,
                    })) as UseOnyxSelector<OnyxKey, {id?: string; name?: string}>,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            const firstResult = result.current[0];

            // Change the data
            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {id: 'changed_id'}));

            // Should return a new reference since data changed
            expect(result.current[0]).not.toBe(firstResult);
            expect(result.current[0]).toEqual({id: 'changed_id', name: 'test_name'});
        });

        it('should memoize selector output using deep equality check', async () => {
            let selectorCallCount = 0;

            Onyx.set(ONYXKEYS.TEST_KEY, {id: 'test_id', name: 'test_name'});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{id: string; name: string}>) => {
                        selectorCallCount++;
                        return {id: entry?.id, name: entry?.name};
                    }) as UseOnyxSelector<OnyxKey, {id?: string; name?: string}>,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            const firstResult = result.current[0];
            const initialCallCount = selectorCallCount;

            // Add a property that will change object reference but keep selected data same
            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {extraProp: 'new'}));

            // Selector should be called again due to input object reference change
            expect(selectorCallCount).toBe(initialCallCount + 1);
            // But output should be the same reference due to deep equality check in memoized selector
            expect(result.current[0]).toBe(firstResult);
        });

        it('should memoize primitive selector results correctly', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, {count: 5, name: 'test'});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<{count: number; name: string}>) => entry?.count || 0) as UseOnyxSelector<OnyxKey, number>,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            const firstResult = result.current[0];
            expect(firstResult).toBe(5);

            // Change unrelated property
            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {name: 'changed'}));

            // Should return the same primitive value (number 5)
            expect(result.current[0]).toBe(firstResult);
            expect(result.current[0]).toBe(5);

            // Change the selected property
            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {count: 10}));

            // Should return new value
            expect(result.current[0]).not.toBe(firstResult);
            expect(result.current[0]).toBe(10);
        });

        it('should recompute selector when dependencies change even if input data stays the same', async () => {
            const testCollection = {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: '1', value: 'item1'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: '2', value: 'item2'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}3`]: {id: '3', value: 'item3'},
            };

            await act(async () => Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, testCollection as GenericCollection));

            let filterIds = ['1'];
            let selectorCallCount = 0;

            const {result, rerender} = renderHook(() =>
                useOnyx(
                    ONYXKEYS.COLLECTION.TEST_KEY,
                    {
                        selector: (collection) => {
                            selectorCallCount++;
                            return filterIds.map((id) => (collection as OnyxCollection<GenericCollection>)?.[`${ONYXKEYS.COLLECTION.TEST_KEY}${id}`]).filter(Boolean);
                        },
                    },
                    [filterIds],
                ),
            );

            await act(async () => waitForPromisesToResolve());

            // Record count after initial stabilization
            const initialCallCount = selectorCallCount;
            const initialResult = result.current[0];

            // Should return item with id '1'
            expect(initialResult).toEqual([{id: '1', value: 'item1'}]);

            // Change dependencies without changing underlying data
            await act(async () => {
                filterIds = ['1', '2'];
                rerender(ONYXKEYS.COLLECTION.TEST_KEY);
            });

            // Selector should recompute and return items with id '1' and '2'
            expect(result.current[0]).toEqual([
                {id: '1', value: 'item1'},
                {id: '2', value: 'item2'},
            ]);
            expect(selectorCallCount).toBeGreaterThan(initialCallCount);

            // Record count after first dependency change
            const firstChangeCallCount = selectorCallCount;

            // Change dependencies again
            await act(async () => {
                filterIds = ['2', '3'];
                rerender(ONYXKEYS.COLLECTION.TEST_KEY);
            });

            // Selector should recompute and return items with id '2' and '3'
            expect(result.current[0]).toEqual([
                {id: '2', value: 'item2'},
                {id: '3', value: 'item3'},
            ]);
            expect(selectorCallCount).toBeGreaterThan(firstChangeCallCount);
        });

        it('should handle complex dependency scenarios with multiple values', async () => {
            type TestItem = {id: string; category: string; priority: number};
            const testData = {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}item1`]: {id: 'item1', category: 'A', priority: 1},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}item2`]: {id: 'item2', category: 'B', priority: 2},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}item3`]: {id: 'item3', category: 'A', priority: 3},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}item4`]: {id: 'item4', category: 'B', priority: 4},
            };

            await act(async () => Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, testData as GenericCollection));

            let categoryFilter = 'A';
            let sortAscending = true;

            const {result, rerender} = renderHook(() =>
                useOnyx(
                    ONYXKEYS.COLLECTION.TEST_KEY,
                    {
                        selector: (collection) => {
                            const typedCollection = collection as OnyxCollection<TestItem>;
                            if (!typedCollection) return [];

                            const filtered = Object.values(typedCollection).filter((item) => item?.category === categoryFilter);

                            return filtered.sort((a, b) => (sortAscending ? (a?.priority ?? 0) - (b?.priority ?? 0) : (b?.priority ?? 0) - (a?.priority ?? 0)));
                        },
                    },
                    [categoryFilter, sortAscending],
                ),
            );

            await act(async () => waitForPromisesToResolve());

            // Should return category A items sorted ascending
            expect(result.current[0]).toEqual([
                {id: 'item1', category: 'A', priority: 1},
                {id: 'item3', category: 'A', priority: 3},
            ]);

            // Change sort order only
            await act(async () => {
                sortAscending = false;
                rerender(ONYXKEYS.COLLECTION.TEST_KEY);
            });

            // Should return category A items sorted descending
            expect(result.current[0]).toEqual([
                {id: 'item3', category: 'A', priority: 3},
                {id: 'item1', category: 'A', priority: 1},
            ]);

            // Change category filter
            await act(async () => {
                categoryFilter = 'B';
                rerender(ONYXKEYS.COLLECTION.TEST_KEY);
            });

            // Should return category B items sorted descending
            expect(result.current[0]).toEqual([
                {id: 'item4', category: 'B', priority: 4},
                {id: 'item2', category: 'B', priority: 2},
            ]);
        });

        it('should not trigger unnecessary recomputations when dependencies remain the same', async () => {
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, {value: 'test'}));

            const dependencies = ['constant'];
            let selectorCallCount = 0;

            const {result, rerender} = renderHook(() =>
                useOnyx(
                    ONYXKEYS.TEST_KEY,
                    {
                        selector: (data) => {
                            selectorCallCount++;
                            return `${dependencies.join(',')}:${(data as {value?: string})?.value}`;
                        },
                    },
                    dependencies,
                ),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toBe('constant:test');
            expect(selectorCallCount).toBe(1);

            // Force rerender without changing dependencies
            await act(async () => {
                rerender(ONYXKEYS.COLLECTION.TEST_KEY);
            });

            // Selector should not recompute since dependencies haven't changed
            expect(result.current[0]).toBe('constant:test');
            expect(selectorCallCount).toBe(1);

            // Update underlying data
            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {value: 'updated'}));

            // Selector should recompute due to data change
            expect(result.current[0]).toBe('constant:updated');
            expect(selectorCallCount).toBe(2);
        });
    });

    describe('allowStaleData', () => {
        it('should return undefined and loading state while we have pending merges for the key, and then return updated value and loaded state', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test1');

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test3');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test4');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('test4');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return undefined and loading state while we have pending merges for the key, and then return selected data and loaded state', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test1');

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test3');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test4');

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    selector: ((entry: OnyxEntry<string>) => `${entry}_changed`) as UseOnyxSelector<OnyxKey, string>,
                }),
            );

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('test4_changed');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return stale value and loaded state if allowStaleData is true, and then return updated value and loaded state', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test1');

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test3');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test4');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY, {allowStaleData: true}));

            expect(result.current[0]).toEqual('test1');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('test4');
            expect(result.current[1].status).toEqual('loaded');
        });
    });

    describe('initWithStoredValues', () => {
        it('should return `undefined` and loaded state, and after merge return updated value and loaded state', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test1');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY, {initWithStoredValues: false}));

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, 'test2'));

            expect(result.current[0]).toEqual('test2');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return `undefined` value and loaded state if using `selector`, and after merge return selected value and loaded state', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test1');

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    initWithStoredValues: false,
                    selector: ((value: OnyxEntry<string>) => `${value}_selected`) as UseOnyxSelector<OnyxKey, string>,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, 'test'));

            expect(result.current[0]).toEqual('test_selected');
            expect(result.current[1].status).toEqual('loaded');
        });
    });

    describe('multiple usage', () => {
        it('should connect to a key and load the value into cache, and return the value loaded in the next hook call', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const {result: result1} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result1.current[0]).toBeUndefined();
            expect(result1.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toEqual('test');
            expect(result1.current[1].status).toEqual('loaded');

            const {result: result2} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result2.current[0]).toEqual('test');
            expect(result2.current[1].status).toEqual('loaded');
        });

        it('should connect to a key two times while data is loading from the cache, and return the value loaded to both of them', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const {result: result1} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));
            const {result: result2} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result1.current[0]).toBeUndefined();
            expect(result1.current[1].status).toEqual('loading');

            expect(result2.current[0]).toBeUndefined();
            expect(result2.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toEqual('test');
            expect(result1.current[1].status).toEqual('loaded');

            expect(result2.current[0]).toEqual('test');
            expect(result2.current[1].status).toEqual('loaded');
        });

        it('"allowStaleData" should work correctly for the same key if more than one hook is using it', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test1');

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test3');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test4');

            const {result: result1} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY, {allowStaleData: true}));

            expect(result1.current[0]).toEqual('test1');
            expect(result1.current[1].status).toEqual('loaded');

            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toEqual('test4');
            expect(result1.current[1].status).toEqual('loaded');

            // Second hook
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test5');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test6');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test7');

            const {result: result2} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY, {allowStaleData: true}));

            expect(result2.current[0]).toEqual('test4');
            expect(result2.current[1].status).toEqual('loaded');

            await act(async () => waitForPromisesToResolve());

            expect(result2.current[0]).toEqual('test7');
            expect(result2.current[1].status).toEqual('loaded');
        });

        it('"initWithStoredValues" should work correctly for the same key if more than one hook is using it', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test1');

            const {result: result1} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY, {initWithStoredValues: false}));

            await act(async () => waitForPromisesToResolve());

            expect(result1.current[0]).toBeUndefined();
            expect(result1.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, 'test2'));

            expect(result1.current[0]).toEqual('test2');
            expect(result1.current[1].status).toEqual('loaded');

            // Second hook
            const {result: result2} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY, {initWithStoredValues: false}));

            await act(async () => waitForPromisesToResolve());

            expect(result2.current[0]).toBeUndefined();
            expect(result2.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, 'test3'));

            expect(result2.current[0]).toEqual('test3');
            expect(result2.current[1].status).toEqual('loaded');
        });
    });

    describe('dependencies', () => {
        it('should return the updated selected value when a external value passed to the dependencies list changes', async () => {
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: {id: 'entry3_id', name: 'entry3_name'},
            } as GenericCollection);

            let externalValue = 'ex1';

            const {result, rerender} = renderHook(() =>
                useOnyx(
                    ONYXKEYS.COLLECTION.TEST_KEY,
                    {
                        selector: ((entries: OnyxCollection<{id: string; name: string}>) =>
                            Object.entries(entries ?? {}).reduce<NonNullable<OnyxCollection<string>>>((acc, [key, value]) => {
                                acc[key] = `${value?.id}_${externalValue}`;
                                return acc;
                            }, {})) as UseOnyxSelector<OnyxKey, NonNullable<OnyxCollection<string>>>,
                    },
                    [externalValue],
                ),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: 'entry1_id_ex1',
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: 'entry2_id_ex1',
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: 'entry3_id_ex1',
            });
            expect(result.current[1].status).toEqual('loaded');

            externalValue = 'ex2';

            await act(async () => {
                rerender(undefined);
            });

            expect(result.current[0]).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: 'entry1_id_ex2',
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: 'entry2_id_ex2',
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: 'entry3_id_ex2',
            });
            expect(result.current[1].status).toEqual('loaded');
        });
    });

    describe('skippable collection member ids', () => {
        it('should always return undefined entry when subscribing to a collection with skippable member ids', async () => {
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}skippable-id`]: {id: 'skippable-id_id', name: 'skippable-id_name'},
            } as GenericCollection);

            const {result} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.TEST_KEY));

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
            });
            expect(result.current[1].status).toEqual('loaded');

            await act(async () =>
                Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                    [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name_changed'},
                    [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name_changed'},
                    [`${ONYXKEYS.COLLECTION.TEST_KEY}skippable-id`]: {id: 'skippable-id_id', name: 'skippable-id_name_changed'},
                } as GenericCollection),
            );

            expect(result.current[0]).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name_changed'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name_changed'},
            });
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should always return undefined when subscribing to a skippable collection member id', async () => {
            await StorageMock.setItem<string>(`${ONYXKEYS.COLLECTION.TEST_KEY}skippable-id`, 'skippable-id_value');

            const {result} = renderHook(() => useOnyx(`${ONYXKEYS.COLLECTION.TEST_KEY}skippable-id`));

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}skippable-id`, 'skippable-id_value_changed'));

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].status).toEqual('loaded');
        });
    });

    // This test suite must be the last one to avoid problems when running the other tests here.
    describe('canEvict', () => {
        const error = (key: string) => `canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({evictableKeys: []}).`;

        beforeEach(() => {
            jest.spyOn(console, 'error').mockImplementation(jest.fn);
        });

        afterEach(() => {
            (console.error as unknown as jest.SpyInstance<void, Parameters<typeof console.error>>).mockRestore();
        });

        it('should throw an error when trying to set the "canEvict" property for a non-evictable key', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            try {
                renderHook(() => useOnyx(ONYXKEYS.TEST_KEY, {canEvict: false}));

                await act(async () => waitForPromisesToResolve());

                fail('Expected to throw an error.');
            } catch (e) {
                expect((e as Error).message).toBe(error(ONYXKEYS.TEST_KEY));
            }
        });

        it('should add the connection to the blocklist when setting "canEvict" to false', async () => {
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
            } as GenericCollection);

            renderHook(() => useOnyx(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`, {canEvict: false}));

            await act(async () => waitForPromisesToResolve());

            const evictionBlocklist = OnyxCache.getEvictionBlocklist();
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`]).toHaveLength(1);
        });

        it('should handle removal/adding the connection to the blocklist properly when changing the evictable key to another', async () => {
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
            } as GenericCollection);

            const {rerender} = renderHook((key: string) => useOnyx(key, {canEvict: false}), {initialProps: `${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1` as string});

            await act(async () => waitForPromisesToResolve());

            const evictionBlocklist = OnyxCache.getEvictionBlocklist();
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`]).toHaveLength(1);
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry2`]).toBeUndefined();

            await act(async () => {
                rerender(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry2`);
            });

            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`]).toBeUndefined();
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry2`]).toHaveLength(1);
        });

        it('should remove the connection from the blocklist when setting "canEvict" to true', async () => {
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
            } as GenericCollection);

            const {rerender} = renderHook((canEvict: boolean) => useOnyx(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`, {canEvict}), {initialProps: false as boolean});

            await act(async () => waitForPromisesToResolve());

            const evictionBlocklist = OnyxCache.getEvictionBlocklist();
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`]).toHaveLength(1);

            await act(async () => {
                rerender(true);
            });

            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`]).toBeUndefined();
        });
    });
});
