import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import onyxStore from './OnyxStore';
import type {OnyxKey, OnyxValue} from './types';

/**
 * Read-only virtual view over the Onyx state. Property access on a key returns
 * the same value as `Onyx.getState(key)` — for collection keys the frozen snapshot,
 * for single keys the cached value, or `undefined` if not present.
 *
 * No tree is materialized. Each property access routes through the store directly.
 */
type OnyxStateView = {
    readonly [K in OnyxKey]: OnyxValue<K>;
};

type UseOnyxStateSelector<T> = (state: OnyxStateView, previousState: OnyxStateView | undefined) => T;

type UseOnyxStateOptions<T> = {
    /**
     * Onyx keys this selector depends on. The selector re-runs only when one of
     * these keys' values changes. Collection keys count as a single dep — any
     * member change triggers a re-run.
     */
    dependencies: readonly OnyxKey[];

    /**
     * Custom equality function for the selector's output. Defaults to `===` with
     * a deep-equal fallback for object outputs. When the comparison returns true,
     * the React update is skipped.
     */
    selectorEquality?: (a: T, b: T) => boolean;
};

/**
 * Lazy, sealed Proxy whose getters route to `onyxStore.getState`. Used as both
 * `state` and `previousState`. The previousState variant captures the dep values
 * frozen at the previous selector invocation.
 */
function createStateView(snapshotProvider: (key: OnyxKey) => OnyxValue<OnyxKey>): OnyxStateView {
    const handler: ProxyHandler<Record<string, never>> = {
        get(_target, prop) {
            if (typeof prop !== 'string') {
                return undefined;
            }
            return snapshotProvider(prop);
        },
        set() {
            // Read-only — selector must not mutate the view.
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

const liveStateView = createStateView((key) => onyxStore.getState(key as OnyxKey));

/**
 * Default equality: reference equality with a deepEqual fallback for object outputs.
 * Primitives and frozen-snapshot references compare correctly with `===`. Objects that
 * the selector freshly allocates with the same content fall back to deepEqual.
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
 * Subscribe to a derived value computed from multiple Onyx keys. The selector
 * receives a virtual `state` view and a `previousState` view holding the values
 * of declared deps as of the last committed render. `previousState` may be used
 * both as a performance aid (ref-equality walks for incremental compute — structural
 * sharing makes unchanged collection members share references with the previous
 * snapshot, so the walk is O(collection_size) with O(1) per-step cost) AND as a
 * semantic input (the output is allowed to depend on it, e.g. a delta of what changed).
 *
 * Re-runs when any declared dep changes; skips React updates when the selector
 * output is equal to the previous output (per `selectorEquality`, default
 * `===` with deepEqual fallback).
 *
 * `previousState` is advanced in a post-commit effect, NOT during `getSnapshot`.
 * This keeps `getSnapshot` pure (a `useSyncExternalStore` requirement): within a
 * single render `previousViewRef` is frozen, so every `getSnapshot` call computes
 * the same output regardless of how many times React invokes it. It also gives
 * `previousState` the correct meaning — "deps at the last *committed* output": a
 * store change whose output is equality-gated away never commits, so it never
 * advances `previousState` past a value the consumer never saw.
 */
function useOnyxState<T>(selector: UseOnyxStateSelector<T>, options: UseOnyxStateOptions<T>): T {
    const {dependencies, selectorEquality = defaultSelectorEquality} = options;

    // Consumers usually pass an inline array literal (new reference every render), so we key
    // the memo on the joined contents — `depsArray` only gets a new reference when the actual
    // set of dependency keys changes, which keeps `subscribe` from re-subscribing every render.
    // The space separator is safe because Onyx keys are identifiers/collection prefixes that
    // never contain spaces.
    //
    // Keying on `depsKey` (content) rather than `dependencies` (identity) is something React
    // Compiler can't preserve, so this hook opts out of compiler memoization and manages its
    // own — deliberate, as it's hand-tuned for `useSyncExternalStore`.
    const depsKey = dependencies.join(' ');
    const depsArray = useMemo(() => [...dependencies], [depsKey]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization

    // Only `subscribe` must be referentially stable for `useSyncExternalStore` (it controls
    // re-subscription). `getSnapshot` may change identity freely — React just re-reads it —
    // so it closes over the latest `selector`/`selectorEquality` directly instead of via refs.
    const subscribe = useCallback((onStoreChange: () => void) => onyxStore.subscribeState(onStoreChange, depsArray), [depsArray]);

    // `previousViewRef` is a Proxy over the dep values captured at the last committed
    // render. It is ONLY mutated in the effect below (post-commit), never in getSnapshot,
    // so it stays constant while a render's getSnapshot calls run.
    const previousViewRef = useRef<OnyxStateView | undefined>(undefined);
    const lastOutputRef = useRef<{value: T} | null>(null);

    const getSnapshot = useCallback((): T => {
        const output = selector(liveStateView, previousViewRef.current);

        // Ref-preservation: when the new output is equal to the last one, return the previous
        // reference so React can bail out via `===`. This also keeps getSnapshot returning a
        // stable value for an unchanged store, despite its identity changing between renders.
        if (lastOutputRef.current !== null && selectorEquality(lastOutputRef.current.value, output)) {
            return lastOutputRef.current.value;
        }

        lastOutputRef.current = {value: output};
        return output;
    }, [selector, selectorEquality]);

    const value = useSyncExternalStore(subscribe, getSnapshot);

    // After each committed render, snapshot the current dep values and expose them as
    // `previousState` for the next selector run. Running on commit (not inside getSnapshot)
    // keeps getSnapshot pure and makes `previousState` reflect the last delivered output.
    useEffect(() => {
        const currentDepValues: Record<OnyxKey, OnyxValue<OnyxKey>> = {};
        for (const dep of depsArray) {
            currentDepValues[dep] = onyxStore.getState(dep);
        }
        previousViewRef.current = createStateView((key) => currentDepValues[key]);
    });

    return value;
}

export default useOnyxState;
export type {OnyxStateView, UseOnyxStateOptions, UseOnyxStateSelector};
