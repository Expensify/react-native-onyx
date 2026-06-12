import type {OnyxKey} from '../../lib';
import Onyx from '../../lib';
import onyxStore from '../../lib/OnyxStore';
import cache from '../../lib/OnyxCache';
import * as Logger from '../../lib/Logger';

// We need access to some internal properties of `onyxStore` during the tests but they are private,
// so this workaround allows us to have access to them. The maps are created once in the constructor
// and only ever `.clear()`ed (never reassigned), so capturing the references here stays valid.
// eslint-disable-next-line dot-notation
const keyListeners = onyxStore['keyListeners'];
// eslint-disable-next-line dot-notation
const stateListenersByDep = onyxStore['stateListenersByDep'];

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

describe('OnyxStore', () => {
    // Always start from a clean registry.
    beforeEach(() => {
        onyxStore.clearAll();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('subscribe / notifyKey', () => {
        it('should fire the listener with (value, key) on notifyKey', () => {
            const callback = jest.fn();
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, callback);

            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'hello');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith('hello', ONYXKEYS.TEST_KEY);
        });

        it('should fire all listeners registered on the same key', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, callback1);
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, callback2);

            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 1);

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should not fire the listener after it unsubscribes', () => {
            const callback = jest.fn();
            const unsubscribe = onyxStore.subscribe(ONYXKEYS.TEST_KEY, callback);

            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'first');
            unsubscribe();
            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'second');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenLastCalledWith('first', ONYXKEYS.TEST_KEY);
        });

        it('should only unsubscribe the specific listener, leaving others intact', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const unsubscribe1 = onyxStore.subscribe(ONYXKEYS.TEST_KEY, callback1);
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, callback2);

            unsubscribe1();
            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 1);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should delete the key entry from the internal map once the last listener unsubscribes', () => {
            const unsubscribe = onyxStore.subscribe(ONYXKEYS.TEST_KEY, jest.fn());
            expect(keyListeners.has(ONYXKEYS.TEST_KEY)).toBeTruthy();

            unsubscribe();

            expect(keyListeners.has(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });

        it('should be a no-op to notify a key with no listeners', () => {
            expect(() => onyxStore.notifyKey('keyWithNoListeners' as OnyxKey, 'x')).not.toThrow();
        });

        it('should be idempotent when unsubscribing more than once', () => {
            const callback = jest.fn();
            const unsubscribe = onyxStore.subscribe(ONYXKEYS.TEST_KEY, callback);

            unsubscribe();
            expect(() => unsubscribe()).not.toThrow();

            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 1);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('collection-snapshot routing on notifyKey', () => {
        it('should fire the collection-root snapshot listener with the cache snapshot when a member is written', () => {
            const snapshot = {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}};
            const getCollectionData = jest.spyOn(cache, 'getCollectionData').mockReturnValue(snapshot);

            const callback = jest.fn();
            onyxStore.subscribe(COLLECTION, callback);

            onyxStore.notifyKey(MEMBER_1, {id: 1});

            expect(getCollectionData).toHaveBeenCalledWith(COLLECTION);
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(snapshot, COLLECTION);
        });

        it('should fire both the exact-member listener and the collection-root snapshot listener', () => {
            const snapshot = {[MEMBER_1]: {id: 1}};
            jest.spyOn(cache, 'getCollectionData').mockReturnValue(snapshot);

            const memberCallback = jest.fn();
            const snapshotCallback = jest.fn();
            onyxStore.subscribe(MEMBER_1, memberCallback);
            onyxStore.subscribe(COLLECTION, snapshotCallback);

            onyxStore.notifyKey(MEMBER_1, {id: 1});

            expect(memberCallback).toHaveBeenCalledWith({id: 1}, MEMBER_1);
            expect(snapshotCallback).toHaveBeenCalledWith(snapshot, COLLECTION);
        });

        it('should skip the collection-root listener but still fire the exact-member listener when suppressCollectionSnapshot is set', () => {
            const getCollectionData = jest.spyOn(cache, 'getCollectionData').mockReturnValue({});

            const memberCallback = jest.fn();
            const snapshotCallback = jest.fn();
            onyxStore.subscribe(MEMBER_1, memberCallback);
            onyxStore.subscribe(COLLECTION, snapshotCallback);

            onyxStore.notifyKey(MEMBER_1, {id: 1}, {suppressCollectionSnapshot: true});

            expect(memberCallback).toHaveBeenCalledTimes(1);
            expect(snapshotCallback).not.toHaveBeenCalled();
            // The snapshot is never read when suppressed.
            expect(getCollectionData).not.toHaveBeenCalled();
        });

        it('should not perform collection routing for a non-member single key', () => {
            const getCollectionData = jest.spyOn(cache, 'getCollectionData');
            const callback = jest.fn();
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, callback);

            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'x');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(getCollectionData).not.toHaveBeenCalled();
        });
    });

    describe('notifyCollection', () => {
        it('should fire the snapshot listener once with the cache snapshot', () => {
            const snapshot = {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}};
            jest.spyOn(cache, 'getCollectionData').mockReturnValue(snapshot);

            const callback = jest.fn();
            onyxStore.subscribe(COLLECTION, callback);

            onyxStore.notifyCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}});

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(snapshot, COLLECTION);
        });

        it('should fire exact-member listeners only for members whose value reference changed', () => {
            const shared = {id: 2}; // same reference in snapshot and previous → should be skipped
            const snapshot = {[MEMBER_1]: {id: 1}, [MEMBER_2]: shared};
            jest.spyOn(cache, 'getCollectionData').mockReturnValue(snapshot);

            const member1Callback = jest.fn();
            const member2Callback = jest.fn();
            onyxStore.subscribe(MEMBER_1, member1Callback);
            onyxStore.subscribe(MEMBER_2, member2Callback);

            onyxStore.notifyCollection(
                COLLECTION,
                {[MEMBER_1]: {id: 1}, [MEMBER_2]: shared},
                {[MEMBER_2]: shared}, // previous: member 2 unchanged by reference
            );

            expect(member1Callback).toHaveBeenCalledWith({id: 1}, MEMBER_1);
            expect(member2Callback).not.toHaveBeenCalled();
        });

        it('should be a no-op when the partial collection is empty', () => {
            const callback = jest.fn();
            onyxStore.subscribe(COLLECTION, callback);

            onyxStore.notifyCollection(COLLECTION, {});

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('subscribeState', () => {
        it('should fire when a declared dep changes via notifyKey', () => {
            const callback = jest.fn();
            onyxStore.subscribeState(callback, [ONYXKEYS.TEST_KEY]);

            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'x');

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should not fire when a non-dep key changes', () => {
            const callback = jest.fn();
            onyxStore.subscribeState(callback, [ONYXKEYS.TEST_KEY]);

            onyxStore.notifyKey(ONYXKEYS.OTHER_TEST, 'x');

            expect(callback).not.toHaveBeenCalled();
        });

        it('should fire at most once when both a member key and its collection key are deps (notifyKey)', () => {
            jest.spyOn(cache, 'getCollectionData').mockReturnValue({});
            const callback = jest.fn();
            // Depends on both the collection root AND a specific member — a member write
            // would touch both deps, but the shared `fired` set must dedup to a single call.
            onyxStore.subscribeState(callback, [COLLECTION, MEMBER_1]);

            onyxStore.notifyKey(MEMBER_1, {id: 1});

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should fire at most once when multiple changed members are deps (notifyCollection)', () => {
            jest.spyOn(cache, 'getCollectionData').mockReturnValue({[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}});
            const callback = jest.fn();
            onyxStore.subscribeState(callback, [MEMBER_1, MEMBER_2]);

            onyxStore.notifyCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}});

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should stop firing after it unsubscribes', () => {
            const callback = jest.fn();
            const unsubscribe = onyxStore.subscribeState(callback, [ONYXKEYS.TEST_KEY]);

            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'a');
            unsubscribe();
            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'b');

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should clean up the by-dep index so an unsubscribed dep no longer dispatches', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            // Two entries share the dep; unsubscribing one must not drop the other.
            const unsubscribe1 = onyxStore.subscribeState(callback1, [ONYXKEYS.TEST_KEY]);
            onyxStore.subscribeState(callback2, [ONYXKEYS.TEST_KEY]);

            unsubscribe1();
            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'x');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should delete the dep entry from the internal index once the last state listener unsubscribes', () => {
            const unsubscribe = onyxStore.subscribeState(jest.fn(), [ONYXKEYS.TEST_KEY]);
            expect(stateListenersByDep.has(ONYXKEYS.TEST_KEY)).toBeTruthy();

            unsubscribe();

            expect(stateListenersByDep.has(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });
    });

    describe('hasListenersForKey', () => {
        it('should return true for an exact-key subscriber', () => {
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, jest.fn());
            expect(onyxStore.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeTruthy();
        });

        it('should return true for a member key when its parent collection has a subscriber', () => {
            onyxStore.subscribe(COLLECTION, jest.fn());
            expect(onyxStore.hasListenersForKey(MEMBER_1)).toBeTruthy();
        });

        it('should return false when there are no relevant subscribers', () => {
            expect(onyxStore.hasListenersForKey('someUnwatchedKey')).toBeFalsy();
        });

        it('should return false after the last listener unsubscribes', () => {
            const unsubscribe = onyxStore.subscribe(ONYXKEYS.TEST_KEY, jest.fn());
            unsubscribe();
            expect(onyxStore.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });
    });

    describe('clearAll', () => {
        it('should wipe key, collection, and state subscriptions', () => {
            const keyCallback = jest.fn();
            const stateCallback = jest.fn();
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, keyCallback);
            onyxStore.subscribeState(stateCallback, [ONYXKEYS.TEST_KEY]);

            onyxStore.clearAll();
            onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'x');

            expect(keyCallback).not.toHaveBeenCalled();
            expect(stateCallback).not.toHaveBeenCalled();
            expect(onyxStore.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });
    });

    describe('listener error isolation', () => {
        it('should log a throwing listener and still fire the other listeners', () => {
            const logAlertSpy = jest.spyOn(Logger, 'logAlert').mockImplementation(() => {
                /* empty */
            });
            const throwingCallback = jest.fn(() => {
                throw new Error('boom');
            });
            const healthyCallback = jest.fn();
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, throwingCallback);
            onyxStore.subscribe(ONYXKEYS.TEST_KEY, healthyCallback);

            expect(() => onyxStore.notifyKey(ONYXKEYS.TEST_KEY, 'x')).not.toThrow();

            expect(throwingCallback).toHaveBeenCalledTimes(1);
            expect(healthyCallback).toHaveBeenCalledTimes(1);
            expect(logAlertSpy).toHaveBeenCalled();
        });
    });
});
