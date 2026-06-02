import {act, renderHook} from '@testing-library/react-native';
import Onyx from '../../lib';
import useOnyxState from '../../lib/useOnyxState';
import type {OnyxStateView} from '../../lib/useOnyxState';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import type GenericCollection from '../utils/GenericCollection';

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

            const {result} = renderHook(() => useOnyxState((state) => state[ONYXKEYS.TEST_KEY], {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('hello');
        });

        it('should update when the dependency changes', async () => {
            const {result} = renderHook(() => useOnyxState((state) => state[ONYXKEYS.TEST_KEY], {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());

            await act(async () => {
                Onyx.set(ONYXKEYS.TEST_KEY, 'updated');
                return waitForPromisesToResolve();
            });

            expect(result.current).toEqual('updated');
        });

        it('should NOT re-render when a non-dependency key changes', async () => {
            let renderCount = 0;
            const {result} = renderHook(() => {
                renderCount += 1;
                return useOnyxState((state) => state[ONYXKEYS.TEST_KEY], {dependencies: [ONYXKEYS.TEST_KEY]});
            });
            await act(async () => waitForPromisesToResolve());

            const renderCountAfterMount = renderCount;

            await act(async () => {
                Onyx.set(ONYXKEYS.OTHER_TEST, 'irrelevant');
                return waitForPromisesToResolve();
            });

            expect(renderCount).toEqual(renderCountAfterMount);
            expect(result.current).toBeUndefined();
        });

        it('should re-run when any of multiple dependencies change', async () => {
            const {result} = renderHook(() =>
                useOnyxState((state) => `${state[ONYXKEYS.TEST_KEY] ?? ''}-${state[ONYXKEYS.OTHER_TEST] ?? ''}`, {dependencies: [ONYXKEYS.TEST_KEY, ONYXKEYS.OTHER_TEST]}),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => {
                Onyx.set(ONYXKEYS.TEST_KEY, 'a');
                return waitForPromisesToResolve();
            });
            expect(result.current).toEqual('a-');

            await act(async () => {
                Onyx.set(ONYXKEYS.OTHER_TEST, 'b');
                return waitForPromisesToResolve();
            });
            expect(result.current).toEqual('a-b');
        });
    });

    describe('collection dependency', () => {
        it('should re-run when any member of a collection dependency changes', async () => {
            const {result} = renderHook(() => useOnyxState((state) => Object.keys(state[COLLECTION] ?? {}).length, {dependencies: [COLLECTION]}));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual(0);

            await act(async () => {
                Onyx.merge(MEMBER_1, {id: 1});
                return waitForPromisesToResolve();
            });
            expect(result.current).toEqual(1);

            await act(async () => {
                Onyx.merge(MEMBER_2, {id: 2});
                return waitForPromisesToResolve();
            });
            expect(result.current).toEqual(2);
        });

        it('should re-run on a mergeCollection write', async () => {
            const {result} = renderHook(() => useOnyxState((state) => Object.keys(state[COLLECTION] ?? {}).length, {dependencies: [COLLECTION]}));
            await act(async () => waitForPromisesToResolve());

            await act(async () => {
                Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}} as GenericCollection);
                return waitForPromisesToResolve();
            });

            expect(result.current).toEqual(2);
        });
    });

    describe('previousState', () => {
        it('should pass undefined as previousState on the first selector run', async () => {
            const observed: Array<OnyxStateView | undefined> = [];
            renderHook(() =>
                useOnyxState(
                    (state, previousState) => {
                        observed.push(previousState);
                        return state[ONYXKEYS.TEST_KEY];
                    },
                    {dependencies: [ONYXKEYS.TEST_KEY]},
                ),
            );
            await act(async () => waitForPromisesToResolve());

            // The very first invocation always runs before any output has been captured.
            expect(observed[0]).toBeUndefined();
        });

        it('should expose the prior dependency value through previousState after a change', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'a');

            let sawCurrentBWithPreviousA = false;
            const {rerender} = renderHook(() =>
                useOnyxState(
                    (state, previousState) => {
                        if (state[ONYXKEYS.TEST_KEY] === 'b' && previousState?.[ONYXKEYS.TEST_KEY] === 'a') {
                            sawCurrentBWithPreviousA = true;
                        }
                        return state[ONYXKEYS.TEST_KEY];
                    },
                    {dependencies: [ONYXKEYS.TEST_KEY]},
                ),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => {
                Onyx.set(ONYXKEYS.TEST_KEY, 'b');
                return waitForPromisesToResolve();
            });
            rerender(undefined);

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
                useOnyxState(
                    (state, previousState) => {
                        const current = (state[COLLECTION] ?? {}) as Record<string, unknown>;
                        const previous = (previousState?.[COLLECTION] ?? {}) as Record<string, unknown>;
                        return Object.keys(current)
                            .filter((memberKey) => current[memberKey] !== previous[memberKey])
                            .sort();
                    },
                    {dependencies: [COLLECTION]},
                ),
            );
            await act(async () => waitForPromisesToResolve());

            // Change only MEMBER_2 — the delta should contain exactly MEMBER_2.
            await act(async () => {
                Onyx.merge(MEMBER_2, {v: 2});
                return waitForPromisesToResolve();
            });

            expect(result.current).toEqual([MEMBER_2]);
        });

        it('should recompute the delta on each subsequent change (previousState advances per commit)', async () => {
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {v: 1}, [MEMBER_2]: {v: 1}} as GenericCollection);

            const {result} = renderHook(() =>
                useOnyxState(
                    (state, previousState) => {
                        const current = (state[COLLECTION] ?? {}) as Record<string, unknown>;
                        const previous = (previousState?.[COLLECTION] ?? {}) as Record<string, unknown>;
                        return Object.keys(current)
                            .filter((memberKey) => current[memberKey] !== previous[memberKey])
                            .sort();
                    },
                    {dependencies: [COLLECTION]},
                ),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => {
                Onyx.merge(MEMBER_1, {v: 9});
                return waitForPromisesToResolve();
            });
            expect(result.current).toEqual([MEMBER_1]);

            // A second, independent change must report only MEMBER_2 — proving `previousState`
            // advanced to the post-first-change snapshot rather than staying at the original.
            await act(async () => {
                Onyx.merge(MEMBER_2, {v: 9});
                return waitForPromisesToResolve();
            });
            expect(result.current).toEqual([MEMBER_2]);
        });
    });

    describe('selectorEquality', () => {
        it('should preserve the output reference when the new output is deep-equal (default equality)', async () => {
            const {result} = renderHook(() => useOnyxState((state) => ({length: ((state[ONYXKEYS.TEST_KEY] as string) ?? '').length}), {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());

            await act(async () => {
                Onyx.set(ONYXKEYS.TEST_KEY, 'aa');
                return waitForPromisesToResolve();
            });
            const referenceAfterFirstChange = result.current;
            expect(referenceAfterFirstChange).toEqual({length: 2});

            // New input, same-length string → deep-equal output → the previous reference is kept.
            await act(async () => {
                Onyx.set(ONYXKEYS.TEST_KEY, 'bb');
                return waitForPromisesToResolve();
            });

            expect(result.current).toBe(referenceAfterFirstChange);
        });

        it('should never update after the first value when a custom equality always returns true', async () => {
            const {result} = renderHook(() =>
                useOnyxState((state) => state[ONYXKEYS.TEST_KEY] ?? 'none', {
                    dependencies: [ONYXKEYS.TEST_KEY],
                    selectorEquality: () => true,
                }),
            );
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('none');

            await act(async () => {
                Onyx.set(ONYXKEYS.TEST_KEY, 'changed');
                return waitForPromisesToResolve();
            });

            // Custom equality reports "unchanged", so the React update is skipped.
            expect(result.current).toEqual('none');
        });

        it('should update when a custom equality reports the output changed', async () => {
            const {result} = renderHook(() =>
                useOnyxState((state) => state[ONYXKEYS.TEST_KEY] ?? 'none', {
                    dependencies: [ONYXKEYS.TEST_KEY],
                    selectorEquality: (a, b) => a === b,
                }),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => {
                Onyx.set(ONYXKEYS.TEST_KEY, 'changed');
                return waitForPromisesToResolve();
            });

            expect(result.current).toEqual('changed');
        });
    });
});
