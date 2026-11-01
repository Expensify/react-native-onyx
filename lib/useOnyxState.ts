import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';

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

/** Declaring a collection root also grants its members: any member write fires the root. */
type DeclaredKeys<TDependency extends OnyxKey> = TDependency extends CollectionKeyBase ? TDependency | `${TDependency}${string}` : TDependency;

/**
 * The state view a selector gets, holding only the keys its `dependencies` declared. Reading anything
 * else is the bug this prevents: the key has no listener, and the snapshot cache skips the selector
 * while the declared deps keep their references, so the value would sit there stale.
 *
 * Collection roots are spelled out a second time for the reason `OnyxCollectionRootsView` exists, and
 * the whole thing falls back to the full view when the dependency list is not a literal, since there
 * is then nothing to narrow to.
 */
type OnyxStateViewFor<TDependencies extends readonly OnyxKey[]> = OnyxKey extends TDependencies[number]
    ? OnyxStateView
    : {
          readonly [K in DeclaredKeys<TDependencies[number]>]: OnyxValue<K>;
      } & {
          readonly [K in Extract<TDependencies[number], CollectionKeyBase>]: OnyxCollection<KeyValueMapping[K]>;
      };

type UseOnyxStateSelector<T, TDependencies extends readonly OnyxKey[] = readonly OnyxKey[]> = (
    state: OnyxStateViewFor<TDependencies>,
    previousState: OnyxStateViewFor<TDependencies> | undefined,
) => T;

type UseOnyxStateOptions<T, TDependencies extends readonly OnyxKey[] = readonly OnyxKey[]> = {
    /**
     * Keys the selector reads. It re-runs when one of them changes; a collection key counts as a
     * single dep, so any member change triggers a re-run. The selector's `state` only carries these
     * keys, so reading anything else is a type error rather than a value that silently goes stale.
     */
    dependencies: TDependencies;

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

type SnapshotCache<T, TDependencies extends readonly OnyxKey[]> = {
    value: T;
    selector: UseOnyxStateSelector<T, TDependencies>;
    previousView: OnyxStateView | undefined;
    /** Whether the run that produced `value` read `previousState`. A run that ignored it can't care that it moved. */
    readPreviousState: boolean;
    depValues: Array<OnyxValue<OnyxKey>>;
};

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
function useOnyxState<T, const TDependencies extends readonly OnyxKey[]>(selector: UseOnyxStateSelector<T, TDependencies>, options: UseOnyxStateOptions<T, TDependencies>): T {
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
    const lastSnapshotRef = useRef<SnapshotCache<T, TDependencies> | null>(null);

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
            areDepValuesUnchanged(depsArray, lastSnapshot.depValues)
        ) {
            return lastSnapshot.value;
        }

        const depValues = depsArray.map((dep) => onyxSubscriptionManager.getState(dep));
        previousStateReadRef.current = false;
        // The views carry every key at runtime; the narrowing is a constraint on what a selector may
        // read, so hand them over as the declared shape.
        const output = selector(liveStateView as OnyxStateViewFor<TDependencies>, previousView as OnyxStateViewFor<TDependencies> | undefined);
        const readPreviousState = previousStateReadRef.current;

        // Hand back the previous reference when the output is equal, so React bails out via `===`
        // and an unchanged store keeps returning the same value even as `getSnapshot`'s identity moves.
        const value = lastSnapshot !== null && selectorEquality(lastSnapshot.value, output) ? lastSnapshot.value : output;
        lastSnapshotRef.current = {value, selector, previousView, readPreviousState, depValues};
        return value;
    }, [selector, selectorEquality, depsArray]);

    const value = useSyncExternalStore(subscribe, getSnapshot);

    // Snapshot the deps after a commit that changed the output, to serve as `previousState` on the next
    // selector run. Doing it here rather than in `getSnapshot` keeps that function pure and gives
    // `previousState` its meaning, the deps behind the last committed output: a change whose output
    // the equality check swallowed never commits, so it never advances past a value nobody saw. Running
    // only on output changes also keeps a re-render from a parent from allocating a new view.
    useEffect(() => {
        const currentDepValues: Record<OnyxKey, OnyxValue<OnyxKey>> = {};
        for (const dep of depsArray) {
            currentDepValues[dep] = onyxSubscriptionManager.getState(dep);
        }
        previousViewRef.current = createStateView((key) => {
            previousStateReadRef.current = true;
            return currentDepValues[key];
        });
    }, [value, depsArray]);

    return value;
}

export default useOnyxState;
export type {OnyxStateView, UseOnyxStateOptions, UseOnyxStateSelector};
