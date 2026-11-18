import {act, renderHook} from '@testing-library/react-native';
import {useLayoutEffect} from 'react';

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

    describe('previousState', () => {
        it('should pass undefined as previousState on the first selector run', async () => {
            const observed: Array<OnyxStateView | undefined> = [];
            renderHook(() =>
                useOnyxState((state, previousState) => {
                    observed.push(previousState);
                    return state[ONYXKEYS.TEST_KEY];
                }),
            );
            await act(async () => waitForPromisesToResolve());

            // The very first invocation always runs before any output has been captured.
            expect(observed[0]).toBeUndefined();
        });

        it('should expose the prior dependency value through previousState after a change', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'a');

            let sawCurrentBWithPreviousA = false;
            renderHook(() =>
                useOnyxState((state, previousState) => {
                    if (state[ONYXKEYS.TEST_KEY] === 'b' && previousState?.[ONYXKEYS.TEST_KEY] === 'a') {
                        sawCurrentBWithPreviousA = true;
                    }
                    return state[ONYXKEYS.TEST_KEY];
                }),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'b'));

            expect(sawCurrentBWithPreviousA).toBeTruthy();
        });
    });

    describe('previousState-dependent output (delta selectors)', () => {
        // `previousState` is advanced post-commit, so a selector whose OUTPUT depends on it
        // is stable: within a render the previous view is frozen, so repeated getSnapshot
        // calls produce the same delta.
        it('should return a stable delta of which collection members changed since the last render', async () => {
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {v: 1}, [MEMBER_2]: {v: 1}} as GenericCollection);

            const {result} = renderHook(() =>
                useOnyxState((state, previousState) => {
                    const current = (state[COLLECTION] ?? {}) as Record<string, unknown>;
                    const previous = (previousState?.[COLLECTION] ?? {}) as Record<string, unknown>;
                    return Object.keys(current)
                        .filter((memberKey) => current[memberKey] !== previous[memberKey])
                        .sort();
                }),
            );
            await act(async () => waitForPromisesToResolve());

            // Change only MEMBER_2 — the delta should contain exactly MEMBER_2.
            await act(async () => Onyx.merge(MEMBER_2, {v: 2}));

            expect(result.current).toEqual([MEMBER_2]);
        });

        it('should recompute the delta on each subsequent change (previousState advances per commit)', async () => {
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {v: 1}, [MEMBER_2]: {v: 1}} as GenericCollection);

            const {result} = renderHook(() =>
                useOnyxState((state, previousState) => {
                    const current = (state[COLLECTION] ?? {}) as Record<string, unknown>;
                    const previous = (previousState?.[COLLECTION] ?? {}) as Record<string, unknown>;
                    return Object.keys(current)
                        .filter((memberKey) => current[memberKey] !== previous[memberKey])
                        .sort();
                }),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.merge(MEMBER_1, {v: 9}));
            expect(result.current).toEqual([MEMBER_1]);

            // A second, independent change must report only MEMBER_2 — proving `previousState`
            // advanced to the post-first-change snapshot rather than staying at the original.
            await act(async () => Onyx.merge(MEMBER_2, {v: 9}));
            expect(result.current).toEqual([MEMBER_2]);
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

        it('should still pass previousState to a selector that declares it with a default value', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            // `Function.length` stops counting at the first defaulted parameter, so this selector reports
            // an arity of 1 even though it reads `previousState`.
            const {result} = renderHook(() =>
                useOnyxState((state, previousState = undefined) => `${state[ONYXKEYS.TEST_KEY] as string}/${(previousState?.[ONYXKEYS.TEST_KEY] as string) ?? 'none'}`),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'second'));

            expect(result.current).toEqual('second/first');
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

        it('should report the post-init values as a change against the pre-hydration previousState', async () => {
            // Given a value in storage and a selector that reports what changed since its last output
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from storage');

            const {result} = renderHook(() =>
                useOnyxState((state, previousState) => ({
                    previous: previousState?.[ONYXKEYS.TEST_KEY],
                    current: state[ONYXKEYS.TEST_KEY],
                })),
            );

            // When init hydrates the cache after the first committed render
            Onyx.init({keys: ONYXKEYS});
            await act(async () => waitForPromisesToResolve());

            // Then `previousState` holds the pre-hydration value, so hydration reads as the key
            // appearing rather than as no change at all
            expect(result.current).toEqual({previous: undefined, current: 'from storage'});
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

    describe('previousState after a write between commit and effects', () => {
        it('should keep the values the committed run saw, not a later write', async () => {
            // Given a selector that reports the previous and current value of TEST_KEY
            await Onyx.set(ONYXKEYS.TEST_KEY, 'a');
            const {result} = renderHook(() => {
                const value = useOnyxState((state, previousState) => `${previousState?.[ONYXKEYS.TEST_KEY] as string}->${state[ONYXKEYS.TEST_KEY] as string}`);
                // Layout effects run after the commit but before passive effects, which is where the hook builds previousState
                useLayoutEffect(() => {
                    if (value !== 'a->b') {
                        return;
                    }
                    Onyx.set(ONYXKEYS.TEST_KEY, 'c');
                }, [value]);
                return value;
            });
            await act(async () => waitForPromisesToResolve());

            // When 'b' commits and 'c' is written before the passive effects run
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'b'));
            await act(async () => waitForPromisesToResolve());

            // Then previousState holds 'b', the value behind the committed output, so the b->c change is not lost
            expect(result.current).toEqual('b->c');
        });
    });
});
