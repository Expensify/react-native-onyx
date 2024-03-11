import {act, renderHook} from '@testing-library/react-native';
import type {OnyxEntry} from '../../lib';
import Onyx, {useOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_KEY_2: 'test2_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());

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
    });

    describe('misc', () => {
        it('should return value and loaded state when loading cached key', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toEqual('test');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should initially return null while loading non-cached key, and then return value and loaded state', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, {test: 'test'});

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toEqual(null);
            expect(result.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual({test: 'test'});
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should initially return null and then return cached value after multiple merge operations', async () => {
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test1');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test3');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toEqual(null);
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
    });

    describe('selector', () => {
        it('should return selected data from a non-collection key', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, {id: 'test_id', name: 'test_name'});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    // @ts-expect-error bypass
                    selector: (entry: OnyxEntry<{id: string; name: string}>) => `id - ${entry?.id}, name - ${entry?.name}`,
                }),
            );

            expect(result.current[0]).toEqual('id - test_id, name - test_name');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {id: 'changed_id', name: 'changed_name'}));

            expect(result.current[0]).toEqual('id - changed_id, name - changed_name');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return selected data from a collection key', async () => {
            // @ts-expect-error bypass
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: {id: 'entry3_id', name: 'entry3_name'},
            });

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.COLLECTION.TEST_KEY, {
                    // @ts-expect-error bypass
                    selector: (entry: OnyxEntry<{id: string; name: string}>) => entry?.id,
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

        it('should not change selected data if a property outside the selector was changed', async () => {
            // @ts-expect-error bypass
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: {id: 'entry3_id', name: 'entry3_name'},
            });

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.COLLECTION.TEST_KEY, {
                    // @ts-expect-error bypass
                    selector: (entry: OnyxEntry<{id: string; name: string}>) => entry?.id,
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

            let selector = (entry: OnyxEntry<{id: string; name: string}>) => `id - ${entry?.id}, name - ${entry?.name}`;

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    // @ts-expect-error bypass
                    selector,
                }),
            );

            expect(result.current[0]).toEqual('id - test_id, name - test_name');
            expect(result.current[1].status).toEqual('loaded');

            selector = (entry: OnyxEntry<{id: string; name: string}>) => `id - ${entry?.id}, name - ${entry?.name} - selector changed`;

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {id: 'changed_id', name: 'changed_name'}));

            expect(result.current[0]).toEqual('id - changed_id, name - changed_name - selector changed');
            expect(result.current[1].status).toEqual('loaded');
        });
    });

    describe('initialValue', () => {
        it('should return initial value from non-cached key and then return null', async () => {
            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    initialValue: 'initial value',
                }),
            );

            expect(result.current[0]).toEqual('initial value');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual(null);
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return initial value from cached key and then return cached value', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, {test: 'test'});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    initialValue: 'initial value',
                }),
            );

            expect(result.current[0]).toEqual('initial value');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual({test: 'test'});
            expect(result.current[1].status).toEqual('loaded');
        });
    });

    describe('allowStaleData', () => {
        it('should return null and loading state while we have pending merges for the key, and then return updated value and loaded state', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test1');

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test3');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test4');

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

            expect(result.current[0]).toEqual(null);
            expect(result.current[1].status).toEqual('loading');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('test4');
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return initial value and loaded state while we have pending merges for the key, and then return updated value and loaded state', async () => {
            Onyx.set(ONYXKEYS.TEST_KEY, 'test1');

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test3');
            Onyx.merge(ONYXKEYS.TEST_KEY, 'test4');

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    initialValue: 'initial value',
                }),
            );

            expect(result.current[0]).toEqual('initial value');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('test4');
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
        it('should return null and loaded state, and after merge return updated value and loaded state', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, {test: 'test1'});

            const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY, {initWithStoredValues: false}));

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual(null);
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {test: 'test2'}));

            expect(result.current[0]).toEqual({test: 'test2'});
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return initial value and loaded state, and after merge return updated value and loaded state', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, {test: 'test1'});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    initWithStoredValues: false,
                    initialValue: 'initial value',
                }),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('initial value');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {test: 'test2'}));

            expect(result.current[0]).toEqual({test: 'test2'});
            expect(result.current[1].status).toEqual('loaded');
        });

        it('should return selected value and loaded state, and after merge return updated selected value and loaded state', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, {test: 'test1'});

            const {result} = renderHook(() =>
                useOnyx(ONYXKEYS.TEST_KEY, {
                    initWithStoredValues: false,
                    // @ts-expect-error bypass
                    selector: (value: OnyxEntry<{test: string}>) => `${value?.test}_selected`,
                }),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current[0]).toEqual('undefined_selected');
            expect(result.current[1].status).toEqual('loaded');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {test: 'test2'}));

            expect(result.current[0]).toEqual('test2_selected');
            expect(result.current[1].status).toEqual('loaded');
        });
    });
});
