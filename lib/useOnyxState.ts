import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';

import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxKey, OnyxValue} from './types';

import onyxSubscriptionManager from './OnyxSubscriptionManager';
import OnyxUtils from './OnyxUtils';

/**
 * Collection roots, mapped to the whole collection.
 *
 * Mapping over `OnyxKey` alone cannot type them: collection keys reach it as the template
 * `${CollectionKeyBase}${string}`, which becomes one index signature typed off that template rather
 * than off the key you index with. The template does not extend `CollectionKeyBase`, so `OnyxValue`
 * resolves it to a member, and a root such as `report_` matches the signature and comes back typed
 * as a single report. Spelling the roots out separately gives them a declared property, which wins
 * over the index signature. Resolves to `unknown` without `CustomTypeOptions`, leaving the view as it
 * was, since every key there is already `unknown`.
 */
type OnyxCollectionRootsView = string extends CollectionKeyBase
    ? unknown
    : {
          readonly [K in CollectionKeyBase]: OnyxCollection<KeyValueMapping[K]>;
      };

/**
 * Read-only view over the Onyx state. Reading a key returns what `getState` returns: the frozen
 * snapshot for a collection key, the cached value for a single key, `undefined` when absent.
 * Nothing is materialized — every read routes through the store.
 */
type OnyxStateView = {
    readonly [K in OnyxKey]: OnyxValue<K>;
} & OnyxCollectionRootsView;

type UseOnyxStateSelector<T> = (state: OnyxStateView, previousState: OnyxStateView | undefined) => T;

type UseOnyxStateOptions<T> = {
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

/** Collects the keys the running selector reads from `liveStateView`, `null` when nothing is recording. */
let activeRecorder: Set<OnyxKey> | null = null;

const liveStateView = createStateView((key) => {
    activeRecorder?.add(key as OnyxKey);
    return onyxSubscriptionManager.getState(key as OnyxKey);
});

type SnapshotCache<T> = {
    value: T;
    selector: UseOnyxStateSelector<T>;
    previousView: OnyxStateView | undefined;
    /** Whether the run that produced `value` read `previousState`. A run that ignored it can't care that it moved. */
    readPreviousState: boolean;
    /** The keys the run read. Same reference while the set is unchanged. */
    deps: readonly OnyxKey[];
    depValues: Array<OnyxValue<OnyxKey>>;
};

type StateSubscription = {
    keys: readonly OnyxKey[];
    unsubscribe: () => void;
    /** Moves the subscription to the keys the latest selector run read. */
    syncKeys: () => void;
};

/** Runs the selector with `liveStateView` recording, and returns the set of keys it read. */
function recordReads<T>(run: () => T): {output: T; keys: Set<OnyxKey>} {
    const keys = new Set<OnyxKey>();
    const outerRecorder = activeRecorder;
    activeRecorder = keys;
    try {
        return {output: run(), keys};
    } finally {
        activeRecorder = outerRecorder;
    }
}

function isSameKeySet(keys: readonly OnyxKey[], recorded: Set<OnyxKey>): boolean {
    return keys.length === recorded.size && keys.every((key) => recorded.has(key));
}

/** True when every dep still reads as the same reference it had when `depValues` was taken. */
function areDepValuesUnchanged(deps: readonly OnyxKey[], depValues: Array<OnyxValue<OnyxKey>>): boolean {
    if (deps.length !== depValues.length) {
        return false;
    }
    for (let i = 0; i < deps.length; i++) {
        if (!Object.is(onyxSubscriptionManager.getState(deps[i]), depValues[i])) {
            return false;
        }
    }
    return true;
}

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
 * and a `previousState` view holding the keys it read as of the last committed render. It can use
 * `previousState` to walk only what changed (structural sharing keeps unchanged collection members
 * reference-equal, so each step is O(1)) or as a real input, say to emit a delta.
 *
 * Each selector run records the keys it read from `state`, and the hook subscribes to exactly those.
 * A run's output depends only on what it read, so a key it skipped can't change it until a key it did
 * read changes and the selector runs again. Reading `report_1` subscribes to that member only, while
 * reading the `report_` root subscribes to every member.
 *
 * Skips the React update when the output is equal to the previous one, per `selectorEquality`.
 *
 * Mounting before `Onyx.init` has hydrated runs the selector against an empty state and re-runs it
 * once init lands. There is no status channel, so a consumer that must tell "not hydrated yet" from
 * "absent" has to carry that in its own output.
 */
function useOnyxState<T>(selector: UseOnyxStateSelector<T>, options: UseOnyxStateOptions<T> = {}): T {
    const {selectorEquality = defaultSelectorEquality} = options;

    // Mutated only in the post-commit effect below, so it stays frozen across a render's
    // `getSnapshot` calls and every one of them computes the same output.
    const previousViewRef = useRef<OnyxStateView | undefined>(undefined);
    const lastSnapshotRef = useRef<SnapshotCache<T> | null>(null);
    const subscriptionRef = useRef<StateSubscription | null>(null);

    // Only `subscribe` has to be referentially stable, since it controls re-subscription.
    // `getSnapshot` may change identity freely, so it closes over the latest selector directly.
    const subscribe = useCallback((onStoreChange: () => void) => {
        // React's store-change handler calls `getSnapshot` synchronously, so once it returns the latest
        // run's keys are in `lastSnapshotRef`. Moving the subscription here rather than only after a
        // commit matters when a run reads a new key but returns an equal output: nothing commits then.
        const handleStoreChange = () => {
            onStoreChange();
            subscription.syncKeys();
        };

        // React subscribes after the commit, so the snapshot behind the committed value is already there.
        const keys = lastSnapshotRef.current?.deps ?? [];
        const subscription: StateSubscription = {
            keys,
            unsubscribe: onyxSubscriptionManager.subscribeState(handleStoreChange, keys),
            syncKeys: () => {
                const lastSnapshot = lastSnapshotRef.current;
                if (lastSnapshot === null || subscription.keys === lastSnapshot.deps) {
                    return;
                }
                subscription.unsubscribe();
                subscription.keys = lastSnapshot.deps;
                subscription.unsubscribe = onyxSubscriptionManager.subscribeState(handleStoreChange, lastSnapshot.deps);
                // A write that landed on a newly read key before this point fired nobody.
                if (!areDepValuesUnchanged(lastSnapshot.deps, lastSnapshot.depValues)) {
                    handleStoreChange();
                }
            },
        };
        subscriptionRef.current = subscription;

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
                handleStoreChange();
            });
        }

        return () => {
            isActive = false;
            subscription.unsubscribe();
            if (subscriptionRef.current === subscription) {
                subscriptionRef.current = null;
            }
        };
    }, []);

    // Flipped by the `previousState` view when the selector reads a key off it. Read straight after the
    // selector returns, so it describes that run only.
    const previousStateReadRef = useRef(false);

    const getSnapshot = useCallback((): T => {
        const lastSnapshot = lastSnapshotRef.current;
        const previousView = previousViewRef.current;

        // React calls `getSnapshot` on every render, not only after a store change. When the selector,
        // `previousState` and every dep are the same references as last time, the output can't differ,
        // so skip the selector and its reads through the state view. A parent re-rendering a list of rows
        // otherwise re-runs every row's selector. A selector that ignored `previousState` last time is
        // not affected by it moving, so it stays cached when only the view changed.
        if (
            lastSnapshot !== null &&
            lastSnapshot.selector === selector &&
            (!lastSnapshot.readPreviousState || lastSnapshot.previousView === previousView) &&
            areDepValuesUnchanged(lastSnapshot.deps, lastSnapshot.depValues)
        ) {
            return lastSnapshot.value;
        }

        previousStateReadRef.current = false;
        const {output, keys} = recordReads(() => selector(liveStateView, previousView));
        // Keep the previous array while the set is unchanged, so the effect below can tell by reference.
        const deps = lastSnapshot !== null && isSameKeySet(lastSnapshot.deps, keys) ? lastSnapshot.deps : [...keys];
        const readPreviousState = previousStateReadRef.current;
        const depValues = deps.map((dep) => onyxSubscriptionManager.getState(dep));

        // Hand back the previous reference when the output is equal, so React bails out via `===`
        // and an unchanged store keeps returning the same value even as `getSnapshot`'s identity moves.
        const value = lastSnapshot !== null && selectorEquality(lastSnapshot.value, output) ? lastSnapshot.value : output;
        lastSnapshotRef.current = {value, selector, previousView, readPreviousState, deps, depValues};
        return value;
    }, [selector, selectorEquality]);

    const value = useSyncExternalStore(subscribe, getSnapshot);
    // The run behind `value`. A store change between the commit and the effects below can overwrite the ref.
    const renderedSnapshot = lastSnapshotRef.current;

    // A render can run the selector without a store change, say with a new selector, so the keys can move here too.
    useEffect(() => {
        subscriptionRef.current?.syncKeys();
    });

    // Snapshot the deps after a commit that changed the output, to serve as `previousState` on the next
    // selector run. Doing it here rather than in `getSnapshot` keeps that function pure and gives
    // `previousState` its meaning, the deps behind the last committed output: a change whose output
    // the equality check swallowed never commits, so it never advances past a value nobody saw. Running
    // only on output changes also keeps a re-render from a parent from allocating a new view. The values
    // come from the committed run, not the store, so a write landing before this effect still reads as a change.
    useEffect(() => {
        const committedDepValues: Record<OnyxKey, OnyxValue<OnyxKey>> = {};
        if (renderedSnapshot !== null) {
            for (const [index, dep] of renderedSnapshot.deps.entries()) {
                committedDepValues[dep] = renderedSnapshot.depValues[index];
            }
        }
        previousViewRef.current = createStateView((key) => {
            previousStateReadRef.current = true;
            return committedDepValues[key];
        });
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    return value;
}

export default useOnyxState;
export type {OnyxStateView, UseOnyxStateOptions, UseOnyxStateSelector};
