import type {OnyxKey} from '../../lib';
import Onyx from '../../lib';
import onyxSubscriptionManager from '../../lib/OnyxSubscriptionManager';
import type {Subscription} from '../../lib/OnyxSubscriptionManager';
import cache from '../../lib/OnyxCache';
import * as Logger from '../../lib/Logger';
import OnyxKeys from '../../lib/OnyxKeys';
import StorageMock from '../../lib/storage';
import createDeferredTask from '../../lib/createDeferredTask';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

// We need access to some internal properties of `onyxSubscriptionManager` during the tests but they are private,
// so this workaround allows us to inspect the dependency index.
const listenersByDep = onyxSubscriptionManager['listenersByDep'];

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
    shouldSyncMultipleInstances: true,
});

beforeEach(() => Onyx.clear());

describe('OnyxSubscriptionManager', () => {
    // Always start from a clean registry.
    beforeEach(() => {
        onyxSubscriptionManager.clearAll();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('subscribe / notifyKey', () => {
        it('should signal listeners without a write payload', () => {
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback);

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith();
        });

        it('should fire all listeners registered on the same key', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback1);
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback2);

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should not fire the listener after it unsubscribes', () => {
            const callback = jest.fn();
            const {unsubscribe} = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback);

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            unsubscribe();
            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should only unsubscribe the specific listener, leaving others intact', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const {unsubscribe: unsubscribe1} = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback1);
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback2);

            unsubscribe1();
            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should delete the key entry from the internal map once the last listener unsubscribes', () => {
            const {unsubscribe} = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, jest.fn());
            expect(listenersByDep.has(ONYXKEYS.TEST_KEY)).toBeTruthy();

            unsubscribe();

            expect(listenersByDep.has(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });

        it('should be a no-op to notify a key with no listeners', () => {
            expect(() => onyxSubscriptionManager.notifyKey('keyWithNoListeners' as OnyxKey)).not.toThrow();
        });

        it('should be idempotent when unsubscribing more than once', () => {
            const callback = jest.fn();
            const {unsubscribe} = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback);

            unsubscribe();
            expect(() => unsubscribe()).not.toThrow();

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('getState', () => {
        it('should return the cached value for a single key', () => {
            cache.set(ONYXKEYS.TEST_KEY, 'hello');

            expect(onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY)).toBe('hello');
        });

        it('should return undefined for a single key that is not in the cache', () => {
            expect(onyxSubscriptionManager.getState(ONYXKEYS.OTHER_TEST)).toBeUndefined();
        });

        it('should return the collection object for a collection key', () => {
            const collectionData = {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}};
            jest.spyOn(cache, 'getCollectionData').mockReturnValue(collectionData);

            expect(onyxSubscriptionManager.getState(COLLECTION)).toBe(collectionData);
        });

        it('should return undefined without throwing for an undefined key', () => {
            expect(onyxSubscriptionManager.getState(undefined as unknown as OnyxKey)).toBeUndefined();
        });
    });

    describe('collection routing on notifyKey', () => {
        it('should signal the collection root without reading its snapshot', () => {
            const getCollectionData = jest.spyOn(cache, 'getCollectionData');
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe(COLLECTION, callback);

            onyxSubscriptionManager.notifyKey(MEMBER_1);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(getCollectionData).not.toHaveBeenCalled();
        });

        it('should fire both the exact-member listener and the collection-root listener', () => {
            const memberCallback = jest.fn();
            const collectionCallback = jest.fn();
            onyxSubscriptionManager.subscribe(MEMBER_1, memberCallback);
            onyxSubscriptionManager.subscribe(COLLECTION, collectionCallback);

            onyxSubscriptionManager.notifyKey(MEMBER_1);

            expect(memberCallback).toHaveBeenCalledTimes(1);
            expect(collectionCallback).toHaveBeenCalledTimes(1);
        });

        it('should not perform collection routing for a non-member single key', () => {
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe(COLLECTION, callback);

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('notifyCollection', () => {
        it('should signal the collection once without building a snapshot', () => {
            const getCollectionData = jest.spyOn(cache, 'getCollectionData');
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe(COLLECTION, callback);

            onyxSubscriptionManager.notifyCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}});

            expect(callback).toHaveBeenCalledTimes(1);
            expect(getCollectionData).not.toHaveBeenCalled();
        });

        it('should fire exact-member listeners only for members whose value reference changed', () => {
            const shared = {id: 2}; // same reference in collection and previous, should be skipped
            cache.set(MEMBER_1, {id: 1});
            cache.set(MEMBER_2, shared);
            const getCollectionData = jest.spyOn(cache, 'getCollectionData');

            const member1Callback = jest.fn();
            const member2Callback = jest.fn();
            onyxSubscriptionManager.subscribe(MEMBER_1, member1Callback);
            onyxSubscriptionManager.subscribe(MEMBER_2, member2Callback);

            onyxSubscriptionManager.notifyCollection(
                COLLECTION,
                {[MEMBER_1]: {id: 1}, [MEMBER_2]: shared},
                {[MEMBER_2]: shared}, // previous: member 2 unchanged by reference
            );

            expect(member1Callback).toHaveBeenCalledTimes(1);
            expect(member2Callback).not.toHaveBeenCalled();
            expect(getCollectionData).not.toHaveBeenCalled();
        });

        it('should notify the exact-member listener when the member is deleted without a previous collection', () => {
            const member1Callback = jest.fn();
            onyxSubscriptionManager.subscribe(MEMBER_1, member1Callback);

            // No partialPreviousCollection passed — a removed member reads undefined on both
            // sides and must not be treated as unchanged.
            onyxSubscriptionManager.notifyCollection(COLLECTION, {[MEMBER_1]: null});

            expect(member1Callback).toHaveBeenCalledTimes(1);
        });

        it('should be a no-op when the partial collection is empty', () => {
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe(COLLECTION, callback);

            onyxSubscriptionManager.notifyCollection(COLLECTION, {});

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('dependency sets', () => {
        it('should fire a state listener when one of its deps changes', () => {
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], callback);

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should not fire when a non-dependency key changes', () => {
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], callback);

            onyxSubscriptionManager.notifyKey(ONYXKEYS.OTHER_TEST);

            expect(callback).not.toHaveBeenCalled();
        });

        it('should fire a listener that depends on a collection key when a member is written', () => {
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe([COLLECTION], callback);

            onyxSubscriptionManager.notifyKey(MEMBER_1);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should fire only once when a listener depends on both a member and its collection key', () => {
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe([MEMBER_1, COLLECTION], callback);

            onyxSubscriptionManager.notifyKey(MEMBER_1);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should fire collection and member state listeners once each on notifyCollection', () => {
            const collectionCallback = jest.fn();
            const member1Callback = jest.fn();
            const bothCallback = jest.fn();
            onyxSubscriptionManager.subscribe([COLLECTION], collectionCallback);
            onyxSubscriptionManager.subscribe([MEMBER_1], member1Callback);
            onyxSubscriptionManager.subscribe([COLLECTION, MEMBER_1], bothCallback);

            onyxSubscriptionManager.notifyCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}});

            expect(collectionCallback).toHaveBeenCalledTimes(1);
            expect(member1Callback).toHaveBeenCalledTimes(1);
            expect(bothCallback).toHaveBeenCalledTimes(1);
        });

        it('should not fire a member state listener on notifyCollection when that member did not change', () => {
            // Given a batch that re-sends one member with the reference it already had and changes another
            const unchangedMember = {id: 1};
            const changedMember = {id: 2};
            cache.set(MEMBER_1, unchangedMember);
            cache.set(MEMBER_2, changedMember);
            const unchangedCallback = jest.fn();
            const changedCallback = jest.fn();
            onyxSubscriptionManager.subscribe([MEMBER_1], unchangedCallback);
            onyxSubscriptionManager.subscribe([MEMBER_2], changedCallback);

            // When the batch is dispatched with the previous values
            onyxSubscriptionManager.notifyCollection(COLLECTION, {[MEMBER_1]: unchangedMember, [MEMBER_2]: changedMember}, {[MEMBER_1]: unchangedMember, [MEMBER_2]: {id: 0}});

            // Then only the listener of the changed member fires, the same way exact-key subscribers are skipped
            expect(unchangedCallback).not.toHaveBeenCalled();
            expect(changedCallback).toHaveBeenCalledTimes(1);
        });

        it('should fire a member state listener on notifyCollection when the previous collection does not carry that member', () => {
            // Given a batch whose previous collection says nothing about the member, so it cannot be proven unchanged
            const member = {id: 1};
            cache.set(MEMBER_1, member);
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe([MEMBER_1], callback);

            // When the batch is dispatched
            onyxSubscriptionManager.notifyCollection(COLLECTION, {[MEMBER_1]: member}, {});

            // Then the listener fires
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should fire a listener only once when it re-subscribes with more deps during the dispatch', () => {
            // Given a listener on a member that, once fired, moves its subscription to the member and its collection
            let subscription: Subscription | undefined;
            const callback = jest.fn(() => {
                subscription?.updateDeps([MEMBER_1, COLLECTION]);
            });
            subscription = onyxSubscriptionManager.subscribe(MEMBER_1, callback);
            onyxSubscriptionManager.subscribe(COLLECTION, jest.fn());

            // When the member changes, which dispatches to the member dep and then to the collection dep
            onyxSubscriptionManager.notifyKey(MEMBER_1);

            // The collection bucket also sees the subscription, but it has already been signaled.
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should fire a listener only once when it re-subscribes to another changed member during notifyCollection', () => {
            // Given a listener on one member that, once fired, moves its subscription to both changed members
            let subscription: Subscription | undefined;
            const callback = jest.fn(() => {
                subscription?.updateDeps([MEMBER_1, MEMBER_2]);
            });
            subscription = onyxSubscriptionManager.subscribe([MEMBER_1], callback);
            onyxSubscriptionManager.subscribe(MEMBER_2, jest.fn());

            // When a batch changes both members
            onyxSubscriptionManager.notifyCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}});

            // Then the listener fired once for the whole batch
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should fire on a change to any of several deps', () => {
            const callback = jest.fn();
            onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY, ONYXKEYS.OTHER_TEST], callback);

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            onyxSubscriptionManager.notifyKey(ONYXKEYS.OTHER_TEST);

            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('should stop firing after unsubscribe and clean up the dep index', () => {
            const callback = jest.fn();
            const subscription = onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], callback);
            expect(listenersByDep.has(ONYXKEYS.TEST_KEY)).toBeTruthy();

            subscription.unsubscribe();
            expect(listenersByDep.has(ONYXKEYS.TEST_KEY)).toBeFalsy();

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            expect(callback).not.toHaveBeenCalled();
        });

        it('should touch only the added and removed keys when updateDeps moves the subscription', () => {
            // Given a listener on two keys
            const callback = jest.fn();
            const subscription = onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY, MEMBER_1], callback);
            const keptSet = listenersByDep.get(ONYXKEYS.TEST_KEY);

            // When it drops one key and adds another
            subscription.updateDeps([ONYXKEYS.TEST_KEY, MEMBER_2]);

            // Then the kept key's index is left alone, the dropped key is cleaned up, and the new key is indexed
            expect(listenersByDep.get(ONYXKEYS.TEST_KEY)).toBe(keptSet);
            expect(listenersByDep.has(MEMBER_1)).toBeFalsy();
            expect(listenersByDep.has(MEMBER_2)).toBeTruthy();

            // And only the current deps fire it
            onyxSubscriptionManager.notifyKey(MEMBER_1);
            expect(callback).not.toHaveBeenCalled();
            onyxSubscriptionManager.notifyKey(MEMBER_2);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should ignore updateDeps after unsubscribe', () => {
            // Given a listener that has unsubscribed
            const subscription = onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], jest.fn());
            subscription.unsubscribe();

            // When it is asked to move to a new key
            subscription.updateDeps([MEMBER_1]);

            // Then nothing is indexed, because a late call must not resurrect the subscription
            expect(listenersByDep.has(MEMBER_1)).toBeFalsy();
        });

        it('should isolate a throwing state listener and still fire the others', () => {
            const logAlertSpy = jest.spyOn(Logger, 'logAlert').mockImplementation(() => {
                /* empty */
            });
            const throwingCallback = jest.fn(() => {
                throw new Error('boom');
            });
            const healthyCallback = jest.fn();
            onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], throwingCallback);
            onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], healthyCallback);

            expect(() => onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY)).not.toThrow();

            expect(throwingCallback).toHaveBeenCalledTimes(1);
            expect(healthyCallback).toHaveBeenCalledTimes(1);
            expect(logAlertSpy).toHaveBeenCalled();
        });
    });

    describe('shared callbacks', () => {
        it('should keep one subscription active when another with the same callback unsubscribes', () => {
            const listener = jest.fn();
            const {unsubscribe} = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, listener);
            const subscription = onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], listener);

            unsubscribe();
            expect(onyxSubscriptionManager.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeTruthy();
            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            expect(listener).toHaveBeenCalledTimes(1);

            subscription.unsubscribe();
            expect(onyxSubscriptionManager.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });
    });

    describe('hasListenersForKey', () => {
        it('should return true for an exact-key subscriber', () => {
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, jest.fn());
            expect(onyxSubscriptionManager.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeTruthy();
        });

        it('should return true for a member key when its parent collection has a subscriber', () => {
            onyxSubscriptionManager.subscribe(COLLECTION, jest.fn());
            expect(onyxSubscriptionManager.hasListenersForKey(MEMBER_1)).toBeTruthy();
        });

        it('should return false when there are no relevant subscribers', () => {
            expect(onyxSubscriptionManager.hasListenersForKey('someUnwatchedKey')).toBeFalsy();
        });

        it('should return false after the last listener unsubscribes', () => {
            const {unsubscribe} = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, jest.fn());
            unsubscribe();
            expect(onyxSubscriptionManager.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });

        it('should return true for a key a state listener depends on', () => {
            // Given a state listener, which is what `useOnyxState` registers, and no exact-key subscriber
            onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], jest.fn());

            // Then the key counts as listened to, because a write to it fires that listener
            expect(onyxSubscriptionManager.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeTruthy();
        });

        it('should return true for a member key when a state listener depends on its collection', () => {
            // Given a state listener on the collection root only
            onyxSubscriptionManager.subscribe([COLLECTION], jest.fn());

            // Then a member counts as listened to, because a member write fires collection deps
            expect(onyxSubscriptionManager.hasListenersForKey(MEMBER_1)).toBeTruthy();
        });

        it('should return false after the last state listener unsubscribes', () => {
            // Given a state listener that has been removed
            const subscription = onyxSubscriptionManager.subscribe([ONYXKEYS.TEST_KEY], jest.fn());
            subscription.unsubscribe();

            // Then nothing listens to the key any more
            expect(onyxSubscriptionManager.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });
    });

    describe('clearAll', () => {
        it('should wipe key and collection subscriptions', () => {
            const keyCallback = jest.fn();
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, keyCallback);

            onyxSubscriptionManager.clearAll();
            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);

            expect(keyCallback).not.toHaveBeenCalled();
            expect(onyxSubscriptionManager.hasListenersForKey(ONYXKEYS.TEST_KEY)).toBeFalsy();
        });
    });

    describe('subscription mutation during dispatch', () => {
        it('should fire a listener that unsubscribes and re-subscribes itself during dispatch only once', () => {
            let unsubscribe: () => void = jest.fn();
            const callback = jest.fn(() => {
                unsubscribe();
                unsubscribe = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback).unsubscribe;
            });
            unsubscribe = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, callback).unsubscribe;

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should not deliver the in-flight notification to a listener added during dispatch', () => {
            const lateCallback = jest.fn();
            const firstCallback = jest.fn(() => {
                onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, lateCallback);
            });
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, firstCallback);

            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            expect(lateCallback).not.toHaveBeenCalled();

            // It receives later notifications normally.
            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            expect(lateCallback).toHaveBeenCalledTimes(1);
        });

        it('should still fire a sibling unsubscribed during dispatch this round, but not on later notifications', () => {
            const siblingCallback = jest.fn();
            let unsubscribeSibling: () => void = jest.fn();
            const firstCallback = jest.fn(() => {
                unsubscribeSibling();
            });
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, firstCallback);
            unsubscribeSibling = onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, siblingCallback).unsubscribe;

            // The sibling was registered when dispatch began, so the snapshot still fires it.
            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            expect(siblingCallback).toHaveBeenCalledTimes(1);

            // Now unsubscribed, it does not fire again.
            onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY);
            expect(siblingCallback).toHaveBeenCalledTimes(1);
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
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, throwingCallback);
            onyxSubscriptionManager.subscribe(ONYXKEYS.TEST_KEY, healthyCallback);

            expect(() => onyxSubscriptionManager.notifyKey(ONYXKEYS.TEST_KEY)).not.toThrow();

            expect(throwingCallback).toHaveBeenCalledTimes(1);
            expect(healthyCallback).toHaveBeenCalledTimes(1);
            expect(logAlertSpy).toHaveBeenCalled();
        });
    });
    describe('cache miss reporting', () => {
        let logHmmmSpy: jest.SpyInstance;

        beforeEach(() => {
            logHmmmSpy = jest.spyOn(Logger, 'logHmmm');
        });

        const forgetValueButKeepKey = (key: string) => {
            cache.drop(key);
            cache.clearNullishStorageKeys();
            cache.setAllKeys([key]);
        };

        // The handler Onyx.init registered for changes another tab wrote to storage.
        const getSyncCallback = (): ((pairs: Array<[OnyxKey, unknown]>) => void) => {
            const syncCallback = (StorageMock.keepInstancesSync as jest.Mock).mock.calls.at(-1)?.[0] as ((pairs: Array<[OnyxKey, unknown]>) => void) | undefined;
            expect(syncCallback).toBeDefined();
            return syncCallback as (pairs: Array<[OnyxKey, unknown]>) => void;
        };

        it('should report once when the cache has no value but storage does', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from-storage');
            forgetValueButKeepKey(ONYXKEYS.TEST_KEY);

            expect(onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY)).toBeUndefined();
            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();

            expect(logHmmmSpy).toHaveBeenCalledTimes(1);
            expect(logHmmmSpy).toHaveBeenCalledWith(expect.stringContaining(ONYXKEYS.TEST_KEY));
        });

        it('should report again after Onyx.clear, which ends the session the report belonged to', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from-storage');
            forgetValueButKeepKey(ONYXKEYS.TEST_KEY);
            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();
            expect(logHmmmSpy).toHaveBeenCalledTimes(1);

            await Onyx.clear();
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from-storage');
            forgetValueButKeepKey(ONYXKEYS.TEST_KEY);
            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();

            expect(logHmmmSpy).toHaveBeenCalledTimes(2);
        });

        it('should report the collection prefix rather than the member key', async () => {
            await StorageMock.setItem(MEMBER_1, {id: 1});
            forgetValueButKeepKey(MEMBER_1);

            onyxSubscriptionManager.getState(MEMBER_1);
            await waitForPromisesToResolve();

            expect(logHmmmSpy).toHaveBeenCalledWith(expect.stringContaining(COLLECTION));
            expect(logHmmmSpy).not.toHaveBeenCalledWith(expect.stringContaining(MEMBER_1));
        });

        it('should not report when storage has no value either', async () => {
            forgetValueButKeepKey(ONYXKEYS.TEST_KEY);

            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();

            expect(logHmmmSpy).not.toHaveBeenCalled();
        });

        it('should report when a merge lands on the lost value before storage answers', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, {a: 1, b: 2});
            forgetValueButKeepKey(ONYXKEYS.TEST_KEY);

            // Park the diagnostic's storage read so the merge below lands on the empty cache before it answers.
            const getItemMock = jest.mocked(StorageMock.getItem);
            const readStorage = getItemMock.getMockImplementation();
            const storageAnswer = createDeferredTask();
            getItemMock.mockImplementationOnce((key) => {
                const storedValue = readStorage?.(key);
                return storageAnswer.promise.then(() => storedValue);
            });

            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await Onyx.merge(ONYXKEYS.TEST_KEY, {c: 3});
            storageAnswer.resolve();
            await waitForPromisesToResolve();

            // The merge built on nothing, so {a, b} is gone from cache and storage. The log is the only trace.
            expect(cache.get(ONYXKEYS.TEST_KEY)).toEqual({c: 3});
            expect(await StorageMock.getItem(ONYXKEYS.TEST_KEY)).toEqual({c: 3});
            expect(logHmmmSpy).toHaveBeenCalledTimes(1);
        });

        it('should not read storage or report for a key another tab removed', async () => {
            const syncCallback = getSyncCallback();
            const getItemMock = jest.mocked(StorageMock.getItem);

            await Onyx.set(MEMBER_1, {id: 1});
            await StorageMock.removeItem(MEMBER_1);
            getItemMock.mockClear();
            syncCallback([[MEMBER_1, undefined]]);

            expect(onyxSubscriptionManager.getState(MEMBER_1)).toBeUndefined();
            await waitForPromisesToResolve();

            expect(getItemMock).not.toHaveBeenCalled();
            expect(logHmmmSpy).not.toHaveBeenCalled();
        });

        it('should still report a real miss on a collection after another tab removed one of its members', async () => {
            const syncCallback = getSyncCallback();

            await Onyx.set(MEMBER_1, {id: 1});
            await StorageMock.removeItem(MEMBER_1);
            syncCallback([[MEMBER_1, undefined]]);
            onyxSubscriptionManager.getState(MEMBER_1);
            await waitForPromisesToResolve();

            await StorageMock.setItem(MEMBER_2, {id: 2});
            forgetValueButKeepKey(MEMBER_2);
            onyxSubscriptionManager.getState(MEMBER_2);
            await waitForPromisesToResolve();

            expect(logHmmmSpy).toHaveBeenCalledTimes(1);
            expect(logHmmmSpy).toHaveBeenCalledWith(expect.stringContaining(COLLECTION));
        });

        it('should not report when another tab removes a key and writes it back before this tab reads it', async () => {
            // Given another tab removed a key and this tab applied that removal
            const syncCallback = getSyncCallback();
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            await StorageMock.removeItem(ONYXKEYS.TEST_KEY);
            syncCallback([[ONYXKEYS.TEST_KEY, undefined]]);

            // When that tab writes the key back, and this tab reads it before the sync for that write arrives
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'second');
            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();

            // Then nothing is reported, because nothing was lost
            expect(logHmmmSpy).not.toHaveBeenCalled();
        });

        it('should report a key lost after another tab removed it and it got a value again', async () => {
            // Given a key another tab removed, which then got a value again
            const syncCallback = getSyncCallback();
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            await StorageMock.removeItem(ONYXKEYS.TEST_KEY);
            syncCallback([[ONYXKEYS.TEST_KEY, undefined]]);
            await Onyx.set(ONYXKEYS.TEST_KEY, 'second');

            // When the cache then has no value for it while storage still does
            jest.spyOn(cache, 'get').mockReturnValueOnce(undefined);
            expect(onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY)).toBeUndefined();
            await waitForPromisesToResolve();

            // Then this is a real miss, and the old removal doesn't hide it
            expect(logHmmmSpy).toHaveBeenCalledTimes(1);
        });

        it('should not report a key whose removal and re-add by another tab straddle a clear that keeps it', async () => {
            // Given a key another tab removed
            const syncCallback = getSyncCallback();
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            await StorageMock.removeItem(ONYXKEYS.TEST_KEY);
            syncCallback([[ONYXKEYS.TEST_KEY, undefined]]);

            // When that tab writes it back, and this tab clears while keeping the key before that sync arrives
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'second');
            await Onyx.clear([ONYXKEYS.TEST_KEY]);
            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();

            // Then the pending write-back isn't reported as a lost value
            expect(logHmmmSpy).not.toHaveBeenCalled();
        });

        it('should not report a key the index does not know, which means init has not loaded it', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from-storage');
            cache.drop(ONYXKEYS.TEST_KEY);
            cache.clearNullishStorageKeys();

            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();

            expect(logHmmmSpy).not.toHaveBeenCalled();
        });

        it('should not report a key marked nullish, whose value is absent by definition', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from-storage');
            forgetValueButKeepKey(ONYXKEYS.TEST_KEY);
            cache.addNullishStorageKey(ONYXKEYS.TEST_KEY);

            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();

            expect(logHmmmSpy).not.toHaveBeenCalled();
        });

        it('should not report a RAM-only key, whose stored data is deliberately ignored', async () => {
            OnyxKeys.setRamOnlyKeys(new Set([ONYXKEYS.TEST_KEY]));
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'stale');
            forgetValueButKeepKey(ONYXKEYS.TEST_KEY);

            onyxSubscriptionManager.getState(ONYXKEYS.TEST_KEY);
            await waitForPromisesToResolve();

            expect(logHmmmSpy).not.toHaveBeenCalled();

            OnyxKeys.setRamOnlyKeys(new Set());
        });
    });
});
