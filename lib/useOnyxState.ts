import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';

import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxKey, OnyxValue} from './types';

import onyxSubscriptionManager from './OnyxSubscriptionManager';
import type {Subscription} from './OnyxSubscriptionManager';
import OnyxUtils from './OnyxUtils';

/** Every key, mapped to what `getState` returns for it. */
type OnyxKeysView = {
    readonly [K in OnyxKey]: OnyxValue<K>;
};

/**
 * Read-only view over the Onyx state. Reading a key returns what `getState` returns: the frozen
 * snapshot for a collection key, the cached value for a single key, `undefined` when absent.
 *
 * Collection roots are declared on top of `OnyxKeysView`. Without them TypeScript types a root such
 * as `report_` as a single member. With no `CustomTypeOptions` every key is `unknown`, so the roots
 * are skipped.
 */
type OnyxStateView = string extends CollectionKeyBase
    ? OnyxKeysView
    : OnyxKeysView & {
          readonly [K in CollectionKeyBase]: OnyxCollection<KeyValueMapping[K]>;
      };

type UseOnyxStateSelector<TReturnValue> = (state: OnyxStateView) => TReturnValue;

type UseOnyxStateOptions<TReturnValue> = {
    /**
     * Equality for the selector's output. Defaults to `===` with a deep-equal fallback for objects.
     * When it returns true, the React update is skipped.
     *
     * The default does not deep-compare an output that is a value read straight from the store, such
     * as `state[key]`: a new reference there is returned as a new value, the way `useOnyx` without a
     * selector returns it.
     */
    selectorEquality?: (a: TReturnValue, b: TReturnValue) => boolean;
};

/** Collects the keys the running selector reads from the state view and their values, `null` when nothing is recording. */
let activeRecorder: Map<OnyxKey, OnyxValue<OnyxKey>> | null = null;

/**
 * Reads `key` from the store and records it as a dependency of the running selector. Throws when no
 * selector is running.
 */
function readAndRecord(key: OnyxKey): OnyxValue<OnyxKey> {
    if (activeRecorder === null) {
        throw new Error(`useOnyxState: "${key}" was read from the state view outside a selector. Read every key while the selector runs.`);
    }
    const value = onyxSubscriptionManager.getState(key);
    activeRecorder.set(key, value);
    return value;
}

/** A key list cannot be recorded as a dependency, so enumerating would answer once and never update. */
function throwOnEnumeration(): never {
    throw new Error('useOnyxState: the state view cannot be enumerated. Read keys by name, or read a collection key to get all its members.');
}

/** Read-only Proxy over the store that records every key read through it. */
const liveStateView = new Proxy<Record<string, never>>(
    {},
    {
        get(_target, prop) {
            if (typeof prop !== 'string') {
                return undefined;
            }
            return readAndRecord(prop);
        },
        set() {
            // Read-only: the selector must not mutate the view.
            return false;
        },
        deleteProperty() {
            // Read-only: the selector must not mutate the view.
            return false;
        },
        has(_target, prop) {
            if (typeof prop !== 'string') {
                return false;
            }
            return readAndRecord(prop) !== undefined;
        },
        ownKeys: throwOnEnumeration,
        getOwnPropertyDescriptor: throwOnEnumeration,
    },
) as OnyxStateView;

type SnapshotCache<TValue> = {
    value: TValue;
    selector: UseOnyxStateSelector<TValue>;
    selectorEquality: (a: TValue, b: TValue) => boolean;
    /** The keys that were read in the selector run that produced `value`. Same reference while the set is unchanged. */
    deps: readonly OnyxKey[];
    depValues: Array<OnyxValue<OnyxKey>>;
};

/** Runs the selector with `liveStateView` recording, and returns the keys it read with their values. */
function recordReads<TValue>(run: () => TValue): {output: TValue; reads: Map<OnyxKey, OnyxValue<OnyxKey>>} {
    const reads = new Map<OnyxKey, OnyxValue<OnyxKey>>();
    const outerRecorder = activeRecorder;
    activeRecorder = reads;
    try {
        return {output: run(), reads};
    } finally {
        activeRecorder = outerRecorder;
    }
}

/** True when `recorded` holds exactly the keys in `keys`. */
function isSameKeySet(keys: readonly OnyxKey[], recorded: Map<OnyxKey, OnyxValue<OnyxKey>>): boolean {
    return keys.length === recorded.size && keys.every((key) => recorded.has(key));
}

/** True when every dep still reads as the same reference it had when `depValues` was taken. */
function areDepValuesUnchanged(deps: readonly OnyxKey[], depValues: Array<OnyxValue<OnyxKey>>): boolean {
    for (let i = 0; i < deps.length; i++) {
        if (!Object.is(onyxSubscriptionManager.getState(deps[i]), depValues[i])) {
            return false;
        }
    }
    return true;
}

/**
 * deepEqual for an object the selector freshly allocated with unchanged content. `isOutputEqual` has
 * already settled `===`, which covers primitives and frozen snapshot references.
 */
function defaultSelectorEquality<TValue>(a: TValue, b: TValue): boolean {
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }
    return deepEqual(a, b);
}

/**
 * Compares a new selector output with the previous one. An output that is one of the values the
 * selector read from the store, say a whole collection, is settled by `===` under the default
 * equality.
 */
function isOutputEqual<TValue>(previousOutput: TValue, output: TValue, depValues: Array<OnyxValue<OnyxKey>>, selectorEquality: (a: TValue, b: TValue) => boolean): boolean {
    if (Object.is(previousOutput, output)) {
        return true;
    }
    if (selectorEquality === defaultSelectorEquality && typeof output === 'object' && output !== null && depValues.includes(output)) {
        return false;
    }
    return selectorEquality(previousOutput, output);
}

/** Runs one selector and caches its latest run. */
type Snapshotter<TValue> = {
    getSnapshot: () => TValue;
    /** The latest run of this snapshotter, `null` before its first one. */
    peek: () => SnapshotCache<TValue> | null;
};

type SnapshotterState<TValue> = {
    last: SnapshotCache<TValue> | null;
};

/**
 * Subscribes a component to a value derived from several Onyx keys. The selector gets a `state` view.
 *
 * Each selector run records the keys it read from `state`, and the hook subscribes to exactly those.
 * A run's output depends only on what it read, so a key it skipped can't change it until a key it did
 * read changes and the selector runs again. Reading `report_1` subscribes to that member only, while
 * reading the `report_` root subscribes to every member.
 *
 * Skips the React update when the output is equal to the previous one, per `selectorEquality`.
 *
 * Mounting before `Onyx.init` has hydrated runs the selector against an empty state and re-runs it
 * once init lands.
 */
function useOnyxState<TReturnValue>(selector: UseOnyxStateSelector<TReturnValue>, options: UseOnyxStateOptions<TReturnValue> = {}): TReturnValue {
    const {selectorEquality = defaultSelectorEquality} = options;

    // The snapshotter of the last committed render. A render that never commits does not touch it.
    const committedSnapshotterRef = useRef<Snapshotter<TReturnValue> | null>(null);
    const syncKeysRef = useRef<(() => void) | null>(null);

    // `useSyncExternalStore` unsubscribes and subscribes again whenever `subscribe` changes identity. A new
    // `subscribe` on every render would tear down and rebuild the Onyx subscription on every render, so it has
    // no dependencies and reads what it needs from refs. A new `getSnapshot` costs nothing, since React just
    // calls the latest one, so the snapshotter below can use the current `selector` without a ref.
    const subscribe = useCallback((onStoreChange: () => void) => {
        // React subscribes after the commit, so the snapshot behind the committed value is already there.
        let keys = committedSnapshotterRef.current?.peek()?.deps ?? [];
        let subscription: Subscription | null = onyxSubscriptionManager.subscribe(keys, handleStoreChange);

        // Subscribes to keys the selector's latest run started reading and unsubscribes from keys it stopped reading.
        function syncKeys() {
            const lastSnapshot = committedSnapshotterRef.current?.peek() ?? null;
            if (subscription === null || lastSnapshot === null || keys === lastSnapshot.deps) {
                return;
            }
            keys = lastSnapshot.deps;
            subscription.updateDeps(keys);
            // A write that landed on a newly read key before this point fired nobody.
            if (!areDepValuesUnchanged(keys, lastSnapshot.depValues)) {
                handleStoreChange();
            }
        }

        // Moving the subscription here rather than only after a commit matters when a run reads a new key
        // but returns an equal output: nothing commits then.
        function handleStoreChange() {
            if (subscription === null) {
                return;
            }
            onStoreChange();
            // `onStoreChange` usually runs `getSnapshot` already, so this call normally returns the cached value.
            // Calling it here keeps the keys current even when React has not run `getSnapshot` yet.
            committedSnapshotterRef.current?.getSnapshot();
            syncKeys();
        }
        syncKeysRef.current = syncKeys;

        // `Onyx.init` hydrates the cache without notifying anyone, so a selector that ran before it
        // finished saw an empty state and would never hear the stored values arrive. Re-read once
        // init lands.
        const initTask = OnyxUtils.getDeferredInitTask();
        if (!initTask.isResolved) {
            initTask.promise.then(handleStoreChange);
        }

        return () => {
            subscription?.unsubscribe();
            subscription = null;
        };
    }, []);

    // One snapshotter per selector. Its runs are cached in its own closure rather than in a ref shared
    // by every render, because React can throw a render away (a suspended or interrupted transition).
    // A shared ref would then hold the output of a selector that never reached the screen, and the next
    // run would be compared against it instead of the committed value.
    const snapshotter = useMemo((): Snapshotter<TReturnValue> => {
        const own: SnapshotterState<TReturnValue> = {last: null};

        function getSnapshot(): TReturnValue {
            // The first run has nothing of its own yet, so it starts from the committed snapshot.
            const previous = own.last ?? committedSnapshotterRef.current?.peek() ?? null;

            // React calls `getSnapshot` on every render, not only after a store change. When the selector and
            // every dep are the same references as last time, the output can't differ, so skip the selector
            // and its reads through the state view. A parent re-rendering a list of rows otherwise re-runs
            // every row's selector.
            if (previous !== null && previous.selector === selector && previous.selectorEquality === selectorEquality && areDepValuesUnchanged(previous.deps, previous.depValues)) {
                own.last = previous;
                return previous.value;
            }

            const {output, reads} = recordReads(() => selector(liveStateView));
            // Keep the previous array while the set is unchanged, so `syncKeys` can tell by reference.
            const deps = previous !== null && isSameKeySet(previous.deps, reads) ? previous.deps : [...reads.keys()];
            const depValues = deps.map((dep) => reads.get(dep));

            // Hand back the previous reference when the output is equal, so React bails out via `===`
            // and an unchanged store keeps returning the same value even as `getSnapshot`'s identity moves.
            const value = previous !== null && isOutputEqual(previous.value, output, depValues, selectorEquality) ? previous.value : output;
            own.last = {value, selector, selectorEquality, deps, depValues};
            return value;
        }

        return {getSnapshot, peek: () => own.last};
    }, [selector, selectorEquality]);

    // Declared before `useSyncExternalStore` so that on mount it runs ahead of `subscribe`, which reads it.
    useEffect(() => {
        committedSnapshotterRef.current = snapshotter;
    }, [snapshotter]);

    const value = useSyncExternalStore(subscribe, snapshotter.getSnapshot);

    // A render can run the selector without a store change, say with a new selector, so the keys can move here too.
    useEffect(() => {
        syncKeysRef.current?.();
    });

    return value;
}

export default useOnyxState;
export type {OnyxStateView, UseOnyxStateOptions, UseOnyxStateSelector};
