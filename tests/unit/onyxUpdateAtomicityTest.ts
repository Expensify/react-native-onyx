import type {Connection} from '../../lib/Onyx';
import type {OnyxKey, OnyxUpdate} from '../../lib/types';

import Onyx from '../../lib';
import cache from '../../lib/OnyxCache';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    FIRST: 'first',
    SECOND: 'second',
    UNSET: 'unset',
    COLLECTION: {
        REPORT: 'report_',
        POLICY: 'policy_',
        TRANSACTION: 'transaction_',
        SNAPSHOT: 'snapshot_',
    },
};

const REPORT_1 = `${ONYX_KEYS.COLLECTION.REPORT}1`;
const REPORT_2 = `${ONYX_KEYS.COLLECTION.REPORT}2`;
const POLICY_1 = `${ONYX_KEYS.COLLECTION.POLICY}1`;
const POLICY_2 = `${ONYX_KEYS.COLLECTION.POLICY}2`;
const TRANSACTION_1 = `${ONYX_KEYS.COLLECTION.TRANSACTION}1`;
const TRANSACTION_2 = `${ONYX_KEYS.COLLECTION.TRANSACTION}2`;
const SNAPSHOT_1 = `${ONYX_KEYS.COLLECTION.SNAPSHOT}1`;

/**
 * Connects to every key in `keys` and, on each notification, records whether every key in
 * `expected` already holds its expected value in the cache.
 */
function recordCacheStateOnNotify(keys: OnyxKey[], expected: Record<OnyxKey, unknown>) {
    const observations: Array<{key: OnyxKey; missing: OnyxKey[]}> = [];
    let isRecording = false;
    const connections = keys.map((key) =>
        Onyx.connect({
            key,
            callback: () => {
                if (!isRecording) {
                    return;
                }
                const missing = Object.keys(expected).filter((expectedKey) => JSON.stringify(cache.get(expectedKey)) !== JSON.stringify(expected[expectedKey]));
                observations.push({key, missing});
            },
        }),
    );

    return {
        observations,
        start: () => {
            isRecording = true;
        },
        stop: () => {
            isRecording = false;
            for (const connection of connections) {
                Onyx.disconnect(connection);
            }
        },
    };
}

describe('Onyx.update atomicity', () => {
    let connections: Connection[] = [];

    beforeAll(() => {
        Onyx.init({
            keys: ONYX_KEYS,
            snapshotMergeKeys: ['pendingAction'],
        });
    });

    afterEach(() => {
        for (const connection of connections) {
            Onyx.disconnect(connection);
        }
        connections = [];
        return Onyx.clear();
    });

    it('applies every key of an update to the cache before notifying any subscriber', async () => {
        // Given existing values for keys written by every update path: single-key set and merge, a
        // mergeCollection, two merges into the same collection (grouped into one mergeCollection), a set into
        // another collection (grouped into a partial setCollection), and a merge into a key with no value yet
        await Onyx.multiSet({
            [ONYX_KEYS.FIRST]: {value: 0},
            [ONYX_KEYS.SECOND]: {value: 0},
            [REPORT_1]: {value: 0},
            [REPORT_2]: {value: 0},
            [POLICY_1]: {value: 0},
            [POLICY_2]: {value: 0},
            [TRANSACTION_1]: {value: 0},
            [TRANSACTION_2]: {value: 0},
        });
        await waitForPromisesToResolve();

        const expected = {
            [ONYX_KEYS.FIRST]: {value: 1},
            [ONYX_KEYS.SECOND]: {value: 1},
            [ONYX_KEYS.UNSET]: {value: 1},
            [REPORT_1]: {value: 1},
            [REPORT_2]: {value: 1},
            [POLICY_1]: {value: 1},
            [POLICY_2]: {value: 1},
            [TRANSACTION_1]: {value: 1},
            [TRANSACTION_2]: {value: 1},
        };
        const recorder = recordCacheStateOnNotify(
            [ONYX_KEYS.FIRST, ONYX_KEYS.SECOND, ONYX_KEYS.UNSET, ONYX_KEYS.COLLECTION.REPORT, POLICY_1, POLICY_2, TRANSACTION_1, ONYX_KEYS.COLLECTION.TRANSACTION],
            expected,
        );
        await waitForPromisesToResolve();
        recorder.start();

        // When one update writes all of them
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.FIRST, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.SECOND, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.UNSET, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYX_KEYS.COLLECTION.REPORT, value: {[REPORT_1]: {value: 1}, [REPORT_2]: {value: 1}}},
            {onyxMethod: Onyx.METHOD.MERGE, key: POLICY_1, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE, key: POLICY_2, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET, key: TRANSACTION_1, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET, key: TRANSACTION_2, value: {value: 1}},
        ] as Array<OnyxUpdate<OnyxKey>>);
        recorder.stop();

        // Then every subscriber was notified, and each notification saw the whole update already in the cache
        expect(recorder.observations.map(({key}) => key).sort()).toEqual(
            [ONYX_KEYS.FIRST, ONYX_KEYS.SECOND, ONYX_KEYS.UNSET, ONYX_KEYS.COLLECTION.REPORT, POLICY_1, POLICY_2, TRANSACTION_1, ONYX_KEYS.COLLECTION.TRANSACTION].sort(),
        );
        expect(recorder.observations.filter(({missing}) => missing.length > 0)).toEqual([]);
    });

    it('applies a setCollection and the snapshot merges of an update together with its other keys', async () => {
        // Given a snapshot that holds a report, an existing single key and an existing policy collection
        await Onyx.multiSet({
            [ONYX_KEYS.FIRST]: {value: 0},
            [REPORT_1]: {value: 0},
            [POLICY_1]: {value: 0},
            [SNAPSHOT_1]: {data: {[REPORT_1]: {value: 0}}},
        });
        await waitForPromisesToResolve();

        const expected = {
            [ONYX_KEYS.FIRST]: {value: 1},
            [REPORT_1]: {value: 1, pendingAction: 'update'},
            [POLICY_2]: {value: 1},
            [SNAPSHOT_1]: {data: {[REPORT_1]: {value: 1, pendingAction: 'update'}}},
        };
        const recorder = recordCacheStateOnNotify([ONYX_KEYS.FIRST, REPORT_1, ONYX_KEYS.COLLECTION.POLICY, SNAPSHOT_1], expected);
        await waitForPromisesToResolve();
        recorder.start();

        // When one update merges the single key and the report the snapshot mirrors, and replaces the policy collection
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.FIRST, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE, key: REPORT_1, value: {value: 1, pendingAction: 'update'}},
            {onyxMethod: Onyx.METHOD.SET_COLLECTION, key: ONYX_KEYS.COLLECTION.POLICY, value: {[POLICY_2]: {value: 1}}},
        ] as Array<OnyxUpdate<OnyxKey>>);
        recorder.stop();

        // Then the snapshot, the collection, the report and the single key were all applied before any notification
        expect(recorder.observations.map(({key}) => key).sort()).toEqual([ONYX_KEYS.FIRST, REPORT_1, ONYX_KEYS.COLLECTION.POLICY, SNAPSHOT_1].sort());
        expect(recorder.observations.filter(({missing}) => missing.length > 0)).toEqual([]);
        expect(cache.get(POLICY_1)).toBeUndefined();
    });

    it('adds new collection members in the same key order regardless of the update path that writes them', async () => {
        // Given a collection with no members yet, and a single key
        await waitForPromisesToResolve();

        // When one update merges two new members, sets two more, sets an unrelated key and replaces another collection
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.MERGE, key: REPORT_1, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE, key: REPORT_2, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET, key: `${ONYX_KEYS.COLLECTION.REPORT}3`, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET, key: `${ONYX_KEYS.COLLECTION.REPORT}4`, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE, key: TRANSACTION_1, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET_COLLECTION, key: ONYX_KEYS.COLLECTION.POLICY, value: {[POLICY_1]: {value: 1}}},
        ] as Array<OnyxUpdate<OnyxKey>>);

        // Then the set members come before the merged ones, as they did when the update applied in separate waves, so
        // code that reads collections in key order sees the same order as before
        expect(Object.keys(cache.getCollectionData(ONYX_KEYS.COLLECTION.REPORT) ?? {})).toEqual([`${ONYX_KEYS.COLLECTION.REPORT}3`, `${ONYX_KEYS.COLLECTION.REPORT}4`, REPORT_1, REPORT_2]);
    });

    it('notifies a collection subscriber once for an update that writes the collection through several paths', async () => {
        // Given a subscriber to the report collection
        await Onyx.multiSet({[REPORT_1]: {value: 0}, [REPORT_2]: {value: 0}});
        await waitForPromisesToResolve();
        const callback = jest.fn();
        connections.push(Onyx.connect({key: ONYX_KEYS.COLLECTION.REPORT, callback}));
        await waitForPromisesToResolve();
        callback.mockClear();

        // When one update writes the collection both as a single-member set and through a mergeCollection
        // into a different member, which take different internal paths
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.SET, key: REPORT_1, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYX_KEYS.COLLECTION.REPORT, value: {[REPORT_2]: {value: 1}}},
        ] as Array<OnyxUpdate<OnyxKey>>);

        // Then the collection subscriber fires once, with both members updated
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenLastCalledWith({[REPORT_1]: {value: 1}, [REPORT_2]: {value: 1}}, ONYX_KEYS.COLLECTION.REPORT);
    });

    it('reads merge targets evicted from the cache before applying, keeping the update atomic', async () => {
        // Given two report members and a single key in storage, with one member and the single key evicted from the cache
        await Onyx.multiSet({[ONYX_KEYS.FIRST]: {stored: true}, [REPORT_1]: {stored: true}, [REPORT_2]: {value: 0}, [ONYX_KEYS.SECOND]: {value: 0}});
        await waitForPromisesToResolve();
        for (const key of [ONYX_KEYS.FIRST, REPORT_1]) {
            cache.drop(key);
            cache.addKey(key);
        }

        const expected = {
            [ONYX_KEYS.FIRST]: {stored: true, value: 1},
            [REPORT_1]: {stored: true, value: 1},
            [REPORT_2]: {value: 1},
            [ONYX_KEYS.SECOND]: {value: 1},
        };
        const recorder = recordCacheStateOnNotify([ONYX_KEYS.FIRST, ONYX_KEYS.COLLECTION.REPORT, ONYX_KEYS.SECOND], expected);
        await waitForPromisesToResolve();
        recorder.start();

        // When one update merges into both evicted keys and writes the others
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.FIRST, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE, key: REPORT_1, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE, key: REPORT_2, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.SECOND, value: {value: 1}},
        ] as Array<OnyxUpdate<OnyxKey>>);
        recorder.stop();

        // Then the merges landed on the stored values, and every notification saw the whole update
        expect(recorder.observations.filter(({missing}) => missing.length > 0)).toEqual([]);
        expect(recorder.observations.map(({key}) => key).sort()).toEqual([ONYX_KEYS.FIRST, ONYX_KEYS.COLLECTION.REPORT, ONYX_KEYS.SECOND].sort());
    });

    it('applies an Onyx.merge queued before the update first, keeping call order', async () => {
        // Given existing values for a single key and a collection member that the update will group
        await Onyx.multiSet({[ONYX_KEYS.FIRST]: {value: 0}, [POLICY_1]: {value: 0}});
        await waitForPromisesToResolve();

        // When an Onyx.merge to each key is still queued as the update starts, and the update then writes the same fields
        Onyx.merge(ONYX_KEYS.FIRST, {value: 1, fromMerge: true});
        Onyx.merge(POLICY_1, {value: 1, fromMerge: true});
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.FIRST, value: {value: 2}},
            {onyxMethod: Onyx.METHOD.MERGE, key: POLICY_1, value: {value: 2}},
            {onyxMethod: Onyx.METHOD.MERGE, key: POLICY_2, value: {value: 2}},
        ] as Array<OnyxUpdate<OnyxKey>>);
        await waitForPromisesToResolve();

        // Then the earlier merge landed first: the update's value wins and the merge's other fields survive
        expect(cache.get(ONYX_KEYS.FIRST)).toEqual({value: 2, fromMerge: true});
        expect(cache.get(POLICY_1)).toEqual({value: 2, fromMerge: true});
    });

    it('lands an Onyx.merge called before the update first, then notifies all of the update together', async () => {
        // Given a subscriber to a single key and a second key it reads
        await Onyx.multiSet({[ONYX_KEYS.FIRST]: {value: 0}, [ONYX_KEYS.SECOND]: {value: 0}});
        await waitForPromisesToResolve();
        const expected = {[ONYX_KEYS.FIRST]: {value: 1, fromMerge: true}, [ONYX_KEYS.SECOND]: {value: 1}};
        const recorder = recordCacheStateOnNotify([ONYX_KEYS.FIRST, ONYX_KEYS.SECOND], expected);
        await waitForPromisesToResolve();
        recorder.start();

        // When an Onyx.merge is called for the first key and an update then writes both keys
        Onyx.merge(ONYX_KEYS.FIRST, {fromMerge: true});
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.FIRST, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.SECOND, value: {value: 1}},
        ] as Array<OnyxUpdate<OnyxKey>>);
        await waitForPromisesToResolve();
        recorder.stop();

        // Then the merge notifies on its own before the update has applied, and the update's notifications both
        // see the merge and the whole update applied
        expect(recorder.observations).toHaveLength(3);
        expect(recorder.observations.at(0)).toEqual({key: ONYX_KEYS.FIRST, missing: [ONYX_KEYS.FIRST, ONYX_KEYS.SECOND]});
        expect(recorder.observations.slice(1)).toEqual(
            expect.arrayContaining([
                {key: ONYX_KEYS.FIRST, missing: []},
                {key: ONYX_KEYS.SECOND, missing: []},
            ]),
        );
    });

    it('applies an Onyx.merge called right after the update on top of it', async () => {
        // Given an existing value
        await Onyx.set(ONYX_KEYS.FIRST, {value: 0});
        await waitForPromisesToResolve();

        // When an update merges the key and an Onyx.merge to the same field is called right after, in the same tick
        const updatePromise = Onyx.update([{onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.FIRST, value: {value: 1, fromUpdate: true}}] as Array<OnyxUpdate<OnyxKey>>);
        Onyx.merge(ONYX_KEYS.FIRST, {value: 2});
        await updatePromise;
        await waitForPromisesToResolve();

        // Then the later merge wins, and the update's other fields survive
        expect(cache.get(ONYX_KEYS.FIRST)).toEqual({value: 2, fromUpdate: true});
    });

    it('applies the update after the call returns, so code right after the call reads the previous values', async () => {
        // Given an existing value and a subscriber to it
        await Onyx.set(ONYX_KEYS.FIRST, {value: 0});
        await waitForPromisesToResolve();
        const callback = jest.fn();
        connections.push(Onyx.connect({key: ONYX_KEYS.FIRST, callback}));
        await waitForPromisesToResolve();
        callback.mockClear();

        // When an update is called
        const updatePromise = Onyx.update([{onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.FIRST, value: {value: 1}}] as Array<OnyxUpdate<OnyxKey>>);

        // Then nothing has changed yet when the call returns
        expect(cache.get(ONYX_KEYS.FIRST)).toEqual({value: 0});
        expect(callback).not.toHaveBeenCalled();

        // Then the update has applied once it resolves
        await updatePromise;
        expect(cache.get(ONYX_KEYS.FIRST)).toEqual({value: 1});
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('applies an update that follows an Onyx.clear after the clear, so the clear does not wipe it', async () => {
        // Given an existing value
        await Onyx.set(ONYX_KEYS.FIRST, {value: 0});
        await waitForPromisesToResolve();

        // When Onyx.clear is called and an update is issued before the clear finishes
        Onyx.clear();
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.FIRST, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.SECOND, value: {value: 1}},
        ] as Array<OnyxUpdate<OnyxKey>>);
        await waitForPromisesToResolve();

        // Then the update's values survive the clear
        expect(cache.get(ONYX_KEYS.FIRST)).toEqual({value: 1});
        expect(cache.get(ONYX_KEYS.SECOND)).toEqual({value: 1});
    });

    it('notifies subscribers of an Onyx.multiSet only after every key is in the cache', async () => {
        // Given existing values for two single keys and a collection member
        await Onyx.multiSet({[ONYX_KEYS.FIRST]: {value: 0}, [ONYX_KEYS.SECOND]: {value: 0}, [REPORT_1]: {value: 0}});
        await waitForPromisesToResolve();
        const expected = {[ONYX_KEYS.FIRST]: {value: 1}, [ONYX_KEYS.SECOND]: {value: 1}, [REPORT_1]: {value: 1}};
        const recorder = recordCacheStateOnNotify([ONYX_KEYS.FIRST, ONYX_KEYS.SECOND, REPORT_1], expected);
        await waitForPromisesToResolve();
        recorder.start();

        // When one multiSet writes all of them
        await Onyx.multiSet(expected);
        recorder.stop();

        // Then no notification saw a key that the multiSet had not written yet
        expect(recorder.observations.map(({key}) => key).sort()).toEqual([ONYX_KEYS.FIRST, ONYX_KEYS.SECOND, REPORT_1].sort());
        expect(recorder.observations.filter(({missing}) => missing.length > 0)).toEqual([]);
    });

    it('delivers the latest cached value when a subscriber writes to a key of the batch while it is being notified', async () => {
        // Given a subscriber to the first key that writes the second key when notified
        await Onyx.multiSet({[ONYX_KEYS.FIRST]: {value: 0}, [ONYX_KEYS.SECOND]: {value: 0}});
        await waitForPromisesToResolve();
        let hasWritten = false;
        connections.push(
            Onyx.connect({
                key: ONYX_KEYS.FIRST,
                callback: (value) => {
                    if (hasWritten || (value as {value: number} | undefined)?.value !== 1) {
                        return;
                    }
                    hasWritten = true;
                    Onyx.set(ONYX_KEYS.SECOND, {value: 'fromCallback'});
                },
            }),
        );
        const secondValues: unknown[] = [];
        connections.push(Onyx.connect({key: ONYX_KEYS.SECOND, callback: (value) => secondValues.push(value)}));
        await waitForPromisesToResolve();
        secondValues.length = 0;

        // When one update writes both keys
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.FIRST, value: {value: 1}},
            {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.SECOND, value: {value: 1}},
        ] as Array<OnyxUpdate<OnyxKey>>);
        await waitForPromisesToResolve();

        // Then the second key's subscriber ends on the value written by the callback, not the update's stale one
        expect(secondValues.at(-1)).toEqual({value: 'fromCallback'});
        expect(cache.get(ONYX_KEYS.SECOND)).toEqual({value: 'fromCallback'});
    });
});
