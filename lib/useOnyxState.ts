import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import onyxSubscriptionManager from './OnyxSubscriptionManager';
import OnyxUtils from './OnyxUtils';
import type {OnyxKey, OnyxValue} from './types';

/**
 * Read-only view over the Onyx state. Reading a key returns what `getState` returns: the frozen
 * snapshot for a collection key, the cached value for a single key, `undefined` when absent.
 * Nothing is materialized — every read routes through the store.
 */
type OnyxStateView = {
    readonly [K in OnyxKey]: OnyxValue<K>;
};

type UseOnyxStateSelector<T> = (state: OnyxStateView, previousState: OnyxStateView | undefined) => T;

type UseOnyxStateOptions<T> = {
    /**
     * Keys the selector reads. It re-runs when one of them changes; a collection key counts as a
     * single dep, so any member change triggers a re-run.
     */
    dependencies: readonly OnyxKey[];

    /**
     * Equality for the selector's output. Defaults to `===` with a deep-equal fallback for objects.
     * When it returns true, the React update is skipped.
     */
    selectorEquality?: (a: T, b: T) => boolean;
};

/** Builds a lazy, sealed Proxy over `snapshotProvider`, used for both `state` and `previousState`. */
function createStateView(snapshotProvider: (key: OnyxKey) => OnyxValue<OnyxKey>): OnyxStateView {
    const handler: ProxyHandler<Record<string, never>> = {
        get(_target, prop) {
            if (typeof prop !== 'string') {
                return undefined;
            }
            return snapshotProvider(prop);
        },
        set() {
            // Read-only: the selector must not mutate the view.
            return false;
        },
        deleteProperty() {
            return false;
        },
        has(_target, prop) {
            if (typeof prop !== 'string') {
                return false;
            }
            return snapshotProvider(prop) !== undefined;
        },
    };
    return new Proxy<Record<string, never>>({}, handler) as unknown as OnyxStateView;
}

const liveStateView = createStateView((key) => onyxSubscriptionManager.getState(key as OnyxKey));

/**
 * `===` first, which settles primitives and frozen snapshot references, then deepEqual for an object
 * the selector freshly allocated with unchanged content.
 */
function defaultSelectorEquality<T>(a: T, b: T): boolean {
    if (Object.is(a, b)) {
        return true;
    }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }
    return deepEqual(a, b);
}

/**
 * Subscribes a component to a value derived from several Onyx keys. The selector gets a `state` view
 * and a `previousState` view holding the declared deps as of the last committed render. It can use
 * `previousState` to walk only what changed (structural sharing keeps unchanged collection members
 * reference-equal, so each step is O(1)) or as a real input, say to emit a delta.
 *
 * Re-runs when any declared dep changes, and skips the React update when the output is equal to the
 * previous one, per `selectorEquality`.
 *
 * Mounting before `Onyx.init` has hydrated runs the selector against an empty state and re-runs it
 * once init lands. There is no status channel, so a consumer that must tell "not hydrated yet" from
 * "absent" has to carry that in its own output.
 */
function useOnyxState<T>(selector: UseOnyxStateSelector<T>, options: UseOnyxStateOptions<T>): T {
    const {dependencies, selectorEquality = defaultSelectorEquality} = options;

    // Consumers pass an inline array literal, so key the memo on the contents: `depsArray` only gets
    // a new reference when the set of keys changes, which keeps `subscribe` from re-subscribing on
    // every render. The space separator is safe, Onyx keys never contain spaces. React Compiler
    // can't preserve content-keying, so this hook opts out of it and memoizes by hand.
    const depsKey = dependencies.join(' ');
    const depsArray = useMemo(() => [...dependencies], [depsKey]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization

    // Only `subscribe` has to be referentially stable, since it controls re-subscription.
    // `getSnapshot` may change identity freely, so it closes over the latest selector directly.
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const unsubscribe = onyxSubscriptionManager.subscribeState(onStoreChange, depsArray);

            // `Onyx.init` hydrates the cache without notifying anyone, so a selector that ran before it
            // finished saw an empty state and would never hear the stored values arrive. Re-read once
            // init lands.
            const initTask = OnyxUtils.getDeferredInitTask();
            let isActive = true;
            if (!initTask.isResolved) {
                initTask.promise.then(() => {
                    if (!isActive) {
                        return;
                    }
                    onStoreChange();
                });
            }

            return () => {
                isActive = false;
                unsubscribe();
            };
        },
        [depsArray],
    );

    // Mutated only in the post-commit effect below, so it stays frozen across a render's
    // `getSnapshot` calls and every one of them computes the same output.
    const previousViewRef = useRef<OnyxStateView | undefined>(undefined);
    const lastOutputRef = useRef<{value: T} | null>(null);

    const getSnapshot = useCallback((): T => {
        const output = selector(liveStateView, previousViewRef.current);

        // Hand back the previous reference when the output is equal, so React bails out via `===`
        // and an unchanged store keeps returning the same value even as `getSnapshot`'s identity moves.
        if (lastOutputRef.current !== null && selectorEquality(lastOutputRef.current.value, output)) {
            return lastOutputRef.current.value;
        }

        lastOutputRef.current = {value: output};
        return output;
    }, [selector, selectorEquality]);

    const value = useSyncExternalStore(subscribe, getSnapshot);

    // Snapshot the deps after each committed render, to serve as `previousState` on the next selector
    // run. Doing it here rather than in `getSnapshot` keeps that function pure and gives
    // `previousState` its meaning, the deps behind the last committed output: a change whose output
    // the equality check swallowed never commits, so it never advances past a value nobody saw.
    useEffect(() => {
        const currentDepValues: Record<OnyxKey, OnyxValue<OnyxKey>> = {};
        for (const dep of depsArray) {
            currentDepValues[dep] = onyxSubscriptionManager.getState(dep);
        }
        previousViewRef.current = createStateView((key) => currentDepValues[key]);
    });

    return value;
}

export default useOnyxState;
export type {OnyxStateView, UseOnyxStateOptions, UseOnyxStateSelector};
