import {act, renderHook} from '@testing-library/react-native';

import type {OnyxStateView} from '../../lib/useOnyxState';
import type GenericCollection from '../utils/GenericCollection';

import Onyx from '../../lib';
import {resetDeferredInitTask} from '../../lib/OnyxUtils';
import StorageMock from '../../lib/storage';
import useOnyxState from '../../lib/useOnyxState';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYXKEYS = {
    TEST_KEY: 'test',
    OTHER_TEST: 'otherTest',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

const COLLECTION = ONYXKEYS.COLLECTION.TEST_KEY;
const MEMBER_1 = `${COLLECTION}1`;
const MEMBER_2 = `${COLLECTION}2`;

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());

describe('useOnyxState', () => {
    describe('basic subscription', () => {
        it('should return the derived value from a single dependency', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');

            const {result} = renderHook(() => useOnyxState((state) => state[ONYXKEYS.TEST_KEY]));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('hello');
        });

        it('should update when the dependency changes', async () => {
            const {result} = renderHook(() => useOnyxState((state) => state[ONYXKEYS.TEST_KEY]));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'updated'));

            expect(result.current).toEqual('updated');
        });

        it('should NOT re-render when a non-dependency key changes', async () => {
            let renderCount = 0;
            const {result} = renderHook(() => {
                renderCount += 1;
                return useOnyxState((state) => state[ONYXKEYS.TEST_KEY]);
            });
            await act(async () => waitForPromisesToResolve());

            const renderCountAfterMount = renderCount;

            await act(async () => Onyx.set(ONYXKEYS.OTHER_TEST, 'irrelevant'));

            expect(renderCount).toEqual(renderCountAfterMount);
            expect(result.current).toBeUndefined();
        });

        it('should re-run when any of multiple dependencies change', async () => {
            const {result} = renderHook(() => useOnyxState((state) => `${state[ONYXKEYS.TEST_KEY] ?? ''}-${state[ONYXKEYS.OTHER_TEST] ?? ''}`));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'a'));
            expect(result.current).toEqual('a-');

            await act(async () => Onyx.set(ONYXKEYS.OTHER_TEST, 'b'));
            expect(result.current).toEqual('a-b');
        });
    });

    describe('collection dependency', () => {
        it('should re-run when any member of a collection dependency changes', async () => {
            const {result} = renderHook(() => useOnyxState((state) => Object.keys(state[COLLECTION] ?? {}).length));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual(0);

            await act(async () => Onyx.merge(MEMBER_1, {id: 1}));
            expect(result.current).toEqual(1);

            await act(async () => Onyx.merge(MEMBER_2, {id: 2}));
            expect(result.current).toEqual(2);
        });

        it('should re-run on a mergeCollection write', async () => {
            const {result} = renderHook(() => useOnyxState((state) => Object.keys(state[COLLECTION] ?? {}).length));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}} as GenericCollection));

            expect(result.current).toEqual(2);
        });
    });

    describe('selectorEquality', () => {
        it('should preserve the output reference when the new output is deep-equal (default equality)', async () => {
            const {result} = renderHook(() => useOnyxState((state) => ({length: ((state[ONYXKEYS.TEST_KEY] as string) ?? '').length})));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'aa'));
            const referenceAfterFirstChange = result.current;
            expect(referenceAfterFirstChange).toEqual({length: 2});

            // New input, same-length string → deep-equal output → the previous reference is kept.
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'bb'));

            expect(result.current).toBe(referenceAfterFirstChange);
        });

        it('should never update after the first value when a custom equality always returns true', async () => {
            const {result} = renderHook(() =>
                useOnyxState((state) => state[ONYXKEYS.TEST_KEY] ?? 'none', {
                    selectorEquality: () => true,
                }),
            );
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('none');

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'changed'));

            // Custom equality reports "unchanged", so the React update is skipped.
            expect(result.current).toEqual('none');
        });

        it('should update when a custom equality reports the output changed', async () => {
            const {result} = renderHook(() =>
                useOnyxState((state) => state[ONYXKEYS.TEST_KEY] ?? 'none', {
                    selectorEquality: (a, b) => a === b,
                }),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'changed'));

            expect(result.current).toEqual('changed');
        });
    });

    describe('re-render without a store change', () => {
        it('should not run the selector again when the component re-renders and no dependency changed', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');
            const selector = jest.fn((state: OnyxStateView) => state[ONYXKEYS.TEST_KEY]);
            const {result, rerender} = renderHook((_props: {renderID: number}) => useOnyxState(selector), {initialProps: {renderID: 0}});
            await act(async () => waitForPromisesToResolve());
            const callCountAfterMount = selector.mock.calls.length;

            rerender({renderID: 1});
            rerender({renderID: 2});

            expect(selector).toHaveBeenCalledTimes(callCountAfterMount);
            expect(result.current).toEqual('hello');
        });

        it('should run the selector again when a re-render passes a new selector', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');
            const {result, rerender} = renderHook(({suffix}: {suffix: string}) => useOnyxState((state) => `${state[ONYXKEYS.TEST_KEY] as string}${suffix}`), {
                initialProps: {suffix: '!'},
            });
            await act(async () => waitForPromisesToResolve());

            rerender({suffix: '?'});

            expect(result.current).toEqual('hello?');
        });

        it('should run the selector again on a re-render after a dependency changed', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');
            const selector = jest.fn((state: OnyxStateView) => state[ONYXKEYS.TEST_KEY]);
            const {result} = renderHook(() => useOnyxState(selector));
            await act(async () => waitForPromisesToResolve());
            const callCountAfterMount = selector.mock.calls.length;

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'updated'));

            expect(selector.mock.calls.length).toBeGreaterThan(callCountAfterMount);
            expect(result.current).toEqual('updated');
        });
    });

    describe('before Onyx.init has finished', () => {
        // Providers above the app's migration gate subscribe during a cold start, before the cache has
        // been hydrated, so put Onyx back to "not initialised" for these.
        beforeEach(async () => {
            // `Onyx.clear()` waits for init, so clear storage directly before taking init away.
            await StorageMock.clear();
            resetDeferredInitTask();
        });

        afterEach(async () => {
            Onyx.init({keys: ONYXKEYS});
            await act(async () => waitForPromisesToResolve());
        });

        it('should re-run the selector once init hydrates the cache', async () => {
            // Given values already in storage and a subscriber mounted before init runs
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from storage');
            await StorageMock.setItem(ONYXKEYS.OTHER_TEST, 'other from storage');

            const {result} = renderHook(() => useOnyxState((state) => [state[ONYXKEYS.TEST_KEY], state[ONYXKEYS.OTHER_TEST]].join('|')));

            // Then the selector has only an empty state to work with, because `cache.hydrate()`
            // notifies nobody
            expect(result.current).toEqual('|');

            // When init hydrates the cache
            Onyx.init({keys: ONYXKEYS});
            await act(async () => waitForPromisesToResolve());

            // Then the selector re-runs against what was in storage, rather than being stuck on the
            // empty-state output forever
            expect(result.current).toEqual('from storage|other from storage');
        });
    });

    describe('key tracking', () => {
        it('should not run the selector when a sibling of the read member changes', async () => {
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}} as GenericCollection);
            const selector = jest.fn((state: OnyxStateView) => (state[MEMBER_1] as {id: number} | undefined)?.id);
            const {result} = renderHook(() => useOnyxState(selector));
            await act(async () => waitForPromisesToResolve());
            const callCountAfterMount = selector.mock.calls.length;

            await act(async () => Onyx.merge(MEMBER_2, {id: 22}));
            await act(async () => Onyx.mergeCollection(COLLECTION, {[MEMBER_2]: {id: 222}} as GenericCollection));

            expect(selector).toHaveBeenCalledTimes(callCountAfterMount);
            expect(result.current).toEqual(1);

            await act(async () => Onyx.merge(MEMBER_1, {id: 11}));

            expect(result.current).toEqual(11);
        });

        it('should follow a lookup to the key it points at', async () => {
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {name: 'one'}, [MEMBER_2]: {name: 'two'}} as GenericCollection);
            await Onyx.set(ONYXKEYS.TEST_KEY, '1');
            const selector = jest.fn((state: OnyxStateView) => (state[`${COLLECTION}${state[ONYXKEYS.TEST_KEY] as string}`] as {name: string} | undefined)?.name);
            const {result} = renderHook(() => useOnyxState(selector));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('one');

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, '2'));
            expect(result.current).toEqual('two');

            const callCountAfterSwitch = selector.mock.calls.length;
            await act(async () => Onyx.merge(MEMBER_1, {name: 'one changed'}));
            expect(selector).toHaveBeenCalledTimes(callCountAfterSwitch);

            await act(async () => Onyx.merge(MEMBER_2, {name: 'two changed'}));
            expect(result.current).toEqual('two changed');
        });

        it('should start listening to a key a branch reads for the first time', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'off');
            const {result} = renderHook(() => useOnyxState((state) => (state[ONYXKEYS.TEST_KEY] === 'on' ? state[ONYXKEYS.OTHER_TEST] : 'disabled')));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'on'));
            expect(result.current).toBeUndefined();

            await act(async () => Onyx.set(ONYXKEYS.OTHER_TEST, 'value'));
            expect(result.current).toEqual('value');
        });

        it('should keep tracking per hook when several hooks are mounted', async () => {
            const {result} = renderHook(() => ({
                first: useOnyxState((state) => state[ONYXKEYS.TEST_KEY]),
                second: useOnyxState((state) => state[ONYXKEYS.OTHER_TEST]),
            }));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.OTHER_TEST, 'b'));
            expect(result.current).toEqual({first: undefined, second: 'b'});

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'a'));
            expect(result.current).toEqual({first: 'a', second: 'b'});
        });

        it('should start listening to a newly read key when the output stays the same', async () => {
            // Given a branch that reads OTHER_TEST only once TEST_KEY is 'on', and returns null either way
            await Onyx.set(ONYXKEYS.TEST_KEY, 'off');
            const {result} = renderHook(() => useOnyxState((state) => (state[ONYXKEYS.TEST_KEY] === 'on' ? (state[ONYXKEYS.OTHER_TEST] ?? null) : null)));
            await act(async () => waitForPromisesToResolve());

            // When the branch flips without changing the output, so nothing re-renders
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'on'));
            expect(result.current).toBeNull();

            // Then a write to the newly read key still reaches the hook
            await act(async () => Onyx.set(ONYXKEYS.OTHER_TEST, 'value'));
            expect(result.current).toEqual('value');
        });

        it('should follow a pointer that arrives before the record it points at', async () => {
            // Given a selector that looks up a member through a pointer key, with neither stored yet
            const {result} = renderHook(() =>
                useOnyxState((state) => (state[ONYXKEYS.TEST_KEY] ? ((state[`${COLLECTION}${state[ONYXKEYS.TEST_KEY] as string}`] as {name: string} | undefined)?.name ?? null) : null)),
            );
            await act(async () => waitForPromisesToResolve());

            // When the pointer lands first, the output stays null
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, '1'));
            expect(result.current).toBeNull();

            // Then the record it points at still updates the hook when it arrives
            await act(async () => Onyx.merge(MEMBER_1, {name: 'one'}));
            expect(result.current).toEqual('one');
        });
    });
});
