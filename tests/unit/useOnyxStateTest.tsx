import {deepEqual} from 'fast-equals';
import {act, render, renderHook} from '@testing-library/react-native';
import React, {startTransition, Suspense, useState} from 'react';

import type * as FastEquals from 'fast-equals';

import type {OnyxStateView} from '../../lib/useOnyxState';

import Onyx from '../../lib';
import cache from '../../lib/OnyxCache';
import {resetDeferredInitTask} from '../../lib/OnyxUtils';
import StorageMock from '../../lib/storage';
import useOnyxState from '../../lib/useOnyxState';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

jest.mock('fast-equals', () => {
    const actual = jest.requireActual<typeof FastEquals>('fast-equals');
    return {...actual, deepEqual: jest.fn(actual.deepEqual)};
});

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

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function idOf(value: unknown): number | undefined {
    return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'number' ? value.id : undefined;
}

function nameOf(value: unknown): string | undefined {
    return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' ? value.name : undefined;
}

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
            const {result} = renderHook(() => useOnyxState((state) => `${asString(state[ONYXKEYS.TEST_KEY])}-${asString(state[ONYXKEYS.OTHER_TEST])}`));
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

            await act(async () => Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}}));

            expect(result.current).toEqual(2);
        });
    });

    describe('selectorEquality', () => {
        it('should preserve the output reference when the new output is deep-equal (default equality)', async () => {
            const {result} = renderHook(() => useOnyxState((state) => ({length: asString(state[ONYXKEYS.TEST_KEY]).length})));
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

    describe('raw store value output', () => {
        it('should not deep-compare a collection the selector returned as-is', async () => {
            // Given a selector that returns the collection snapshot itself
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}});
            const {result} = renderHook(() => useOnyxState((state) => state[COLLECTION]));
            await act(async () => waitForPromisesToResolve());
            const collectionBefore = result.current;
            jest.mocked(deepEqual).mockClear();

            // When a member changes, which gives the collection a new reference
            await act(async () => Onyx.merge(MEMBER_1, {id: 10}));
            const collectionAfter = result.current;

            // Then the hook returned the new snapshot without walking both collections: the store only
            // replaces a reference when the content changed, so the comparison could never succeed
            expect(collectionAfter).not.toBe(collectionBefore);
            expect(jest.mocked(deepEqual).mock.calls.some(([a, b]) => a === collectionBefore && b === collectionAfter)).toBe(false);
        });

        it('should still deep-compare an object the selector built', async () => {
            // Given a selector that allocates its output
            await Onyx.set(ONYXKEYS.TEST_KEY, 'aa');
            const {result} = renderHook(() => useOnyxState((state) => ({length: asString(state[ONYXKEYS.TEST_KEY]).length})));
            await act(async () => waitForPromisesToResolve());
            const outputBefore = result.current;

            // When a dependency changes without changing the output's content
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'bb'));

            // Then the previous reference is kept
            expect(result.current).toBe(outputBefore);
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
            const {result, rerender} = renderHook(({suffix}: {suffix: string}) => useOnyxState((state) => `${asString(state[ONYXKEYS.TEST_KEY])}${suffix}`), {
                initialProps: {suffix: '!'},
            });
            await act(async () => waitForPromisesToResolve());

            rerender({suffix: '?'});

            expect(result.current).toEqual('hello?');
        });

        it('should run the selector again on a re-render after a dependency changed', async () => {
            // Given a mounted hook, and a dependency that changes in the cache without a notification,
            // which is how `Onyx.init` hydrates it
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');
            const selector = jest.fn((state: OnyxStateView) => state[ONYXKEYS.TEST_KEY]);
            const {result, rerender} = renderHook((_props: {renderID: number}) => useOnyxState(selector), {initialProps: {renderID: 0}});
            await act(async () => waitForPromisesToResolve());
            const callCountAfterMount = selector.mock.calls.length;
            cache.set(ONYXKEYS.TEST_KEY, 'updated');

            // When the component re-renders with the same selector
            rerender({renderID: 1});

            // Then the selector runs again, because the cached output is only reused while every dependency is unchanged
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
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}});
            const selector = jest.fn((state: OnyxStateView) => idOf(state[MEMBER_1]));
            const {result} = renderHook(() => useOnyxState(selector));
            await act(async () => waitForPromisesToResolve());
            const callCountAfterMount = selector.mock.calls.length;

            await act(async () => Onyx.merge(MEMBER_2, {id: 22}));
            await act(async () => Onyx.mergeCollection(COLLECTION, {[MEMBER_2]: {id: 222}}));

            expect(selector).toHaveBeenCalledTimes(callCountAfterMount);
            expect(result.current).toEqual(1);

            await act(async () => Onyx.merge(MEMBER_1, {id: 11}));

            expect(result.current).toEqual(11);
        });

        it('should follow a lookup to the key it points at', async () => {
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {name: 'one'}, [MEMBER_2]: {name: 'two'}});
            await Onyx.set(ONYXKEYS.TEST_KEY, '1');
            const selector = jest.fn((state: OnyxStateView) => nameOf(state[`${COLLECTION}${asString(state[ONYXKEYS.TEST_KEY])}`]));
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
            const {result} = renderHook(() => useOnyxState((state) => (state[ONYXKEYS.TEST_KEY] ? (nameOf(state[`${COLLECTION}${asString(state[ONYXKEYS.TEST_KEY])}`]) ?? null) : null)));
            await act(async () => waitForPromisesToResolve());

            // When the pointer lands first, the output stays null
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, '1'));
            expect(result.current).toBeNull();

            // Then the record it points at still updates the hook when it arrives
            await act(async () => Onyx.merge(MEMBER_1, {name: 'one'}));
            expect(result.current).toEqual('one');
        });
    });

    describe('state view misuse', () => {
        beforeEach(() => {
            // React logs the error a throwing render raises; keep the test output readable.
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it.each([
            ['Object.keys', (state: OnyxStateView): unknown => Object.keys(state)],
            ['spread', (state: OnyxStateView): unknown => ({...state})],
            [
                'for...in',
                (state: OnyxStateView): unknown => {
                    const keys: string[] = [];
                    // eslint-disable-next-line guard-for-in, no-restricted-syntax
                    for (const key in state) {
                        keys.push(key);
                    }
                    return keys;
                },
            ],
            ['hasOwnProperty', (state: OnyxStateView): unknown => Object.prototype.hasOwnProperty.call(state, ONYXKEYS.TEST_KEY)],
        ])('should throw when the selector enumerates the state view with %s', async (_name, enumerate) => {
            // Given a stored key, so a working enumeration would have something to list
            await Onyx.set(ONYXKEYS.TEST_KEY, 'value');

            // When a selector enumerates the view, which cannot record a dependency
            // Then it throws rather than answering as an empty object the hook would never update
            expect(() => renderHook(() => useOnyxState(enumerate))).toThrow('cannot be enumerated');
        });

        it('should throw when the state view is read after the selector returned', async () => {
            // Given a state view that outlived its selector run, as a closure returned by the selector would hold it
            await Onyx.set(ONYXKEYS.TEST_KEY, 'value');
            const captured: {state?: OnyxStateView} = {};
            renderHook(() =>
                useOnyxState((state) => {
                    captured.state = state;
                    return null;
                }),
            );
            const state = captured.state;
            if (state === undefined) {
                throw new Error('The selector did not run');
            }

            // When it is read with no selector running, so the read cannot be recorded as a dependency
            // Then it throws rather than returning a value the hook will never refresh
            expect(() => state[ONYXKEYS.TEST_KEY]).toThrow('outside a selector');
            expect(() => ONYXKEYS.TEST_KEY in state).toThrow('outside a selector');
        });
    });

    describe('render that never commits', () => {
        /**
         * Mounts a row that reads TEST_KEY's length. `abandonRender` re-renders it in a transition with
         * another selector and suspends, so React runs that selector but never commits its output.
         */
        function renderAbandonableRow() {
            const neverResolves = new Promise<never>(() => {});
            const committedSelector = (state: OnyxStateView) => ({length: asString(state[ONYXKEYS.TEST_KEY]).length});
            const abandonedSelector = (state: OnyxStateView) => ({other: state[ONYXKEYS.OTHER_TEST]});
            const committedRenders: unknown[] = [];
            let abandonedRenderCount = 0;
            let showAbandoned: () => void = () => {};
            let rerenderParent: () => void = () => {};

            function Suspender(): null {
                throw neverResolves;
            }

            function Row({isAbandoned}: {isAbandoned: boolean}) {
                const value = useOnyxState<unknown>(isAbandoned ? abandonedSelector : committedSelector);
                if (isAbandoned) {
                    abandonedRenderCount += 1;
                    return <Suspender />;
                }
                committedRenders.push(value);
                return null;
            }

            function Parent() {
                const [isAbandoned, setIsAbandoned] = useState(false);
                const [, setTick] = useState(0);
                showAbandoned = () => setIsAbandoned(true);
                rerenderParent = () => setTick((tick) => tick + 1);
                return (
                    <Suspense fallback={null}>
                        <Row isAbandoned={isAbandoned} />
                    </Suspense>
                );
            }

            render(<Parent />, {concurrentRoot: true});

            return {
                committedRenders,
                getAbandonedRenderCount: () => abandonedRenderCount,
                abandonRender: () => startTransition(() => showAbandoned()),
                rerenderParent: () => rerenderParent(),
            };
        }

        it('should keep the committed output reference when a re-render follows a render that never committed', async () => {
            // Given a committed row, and a transition render with another selector that suspended before committing
            await Onyx.set(ONYXKEYS.TEST_KEY, 'a');
            const row = renderAbandonableRow();
            await act(async () => waitForPromisesToResolve());
            const committedValue = row.committedRenders.at(-1);
            const committedRenderCount = row.committedRenders.length;
            await act(async () => row.abandonRender());
            expect(row.getAbandonedRenderCount()).toBeGreaterThan(0);

            // When the parent re-renders the row urgently with the committed selector
            await act(async () => row.rerenderParent());

            // Then the row rendered again and got the reference it committed, because the abandoned
            // render's output must not replace the value the next run is compared against
            expect(row.committedRenders.length).toBeGreaterThan(committedRenderCount);
            expect(row.committedRenders.at(-1)).toBe(committedValue);
        });

        it('should not re-render on a write that leaves the output equal after a render that never committed', async () => {
            // Given a committed row, and a transition render with another selector that suspended before committing
            await Onyx.set(ONYXKEYS.TEST_KEY, 'a');
            const row = renderAbandonableRow();
            await act(async () => waitForPromisesToResolve());
            const committedRenderCount = row.committedRenders.length;
            await act(async () => row.abandonRender());
            expect(row.getAbandonedRenderCount()).toBeGreaterThan(0);

            // When a dependency changes to a value of the same length, so the committed selector's output is deep-equal
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'b'));

            // Then the row does not re-render, because the new output is compared against the committed one
            expect(row.committedRenders.length).toBe(committedRenderCount);
        });

        it('should still update the row on a write that changes the output after a render that never committed', async () => {
            // Given a committed row, and a transition render with another selector that suspended before committing
            await Onyx.set(ONYXKEYS.TEST_KEY, 'a');
            const row = renderAbandonableRow();
            await act(async () => waitForPromisesToResolve());
            await act(async () => row.abandonRender());
            expect(row.getAbandonedRenderCount()).toBeGreaterThan(0);

            // When a dependency of the committed selector changes its output
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'abc'));

            // Then the row renders the new output, so the abandoned render did not move the subscription away
            expect(row.committedRenders.at(-1)).toEqual({length: 3});
        });
    });
});
