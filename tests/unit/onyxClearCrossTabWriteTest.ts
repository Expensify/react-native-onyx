import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';
import Onyx from '../../lib/Onyx';
import cache from '../../lib/OnyxCache';
import type {Connection} from '../../lib/Onyx';
import type {OnStorageKeysAnnounced, OnStorageKeysChanged} from '../../lib/storage/providers/types';

const ONYX_KEYS = {
    SESSION: 'session',
    COLLECTION: {
        REPORT: 'report_',
    },
};
const OLD_SESSION = {authToken: 'old'};
const NEW_SESSION = {authToken: 'new'};
const DEFAULT_SESSION = {loading: false};

describe('Another tab writes while Onyx.clear is in progress', () => {
    let connections: Connection[] = [];
    let sessionValue: unknown;
    let reportValue: unknown;
    let finishRemoveItems: () => void;
    let announceKeysFromOtherTab: OnStorageKeysAnnounced;
    let deliverValuesFromOtherTab: OnStorageKeysChanged;

    beforeEach(() => {
        Onyx.init({
            keys: ONYX_KEYS,
            initialKeyStates: {[ONYX_KEYS.SESSION]: DEFAULT_SESSION},
            shouldSyncMultipleInstances: true,
        });
        const [onStorageKeysChanged, onStorageKeysAnnounced] = jest.mocked(StorageMock.keepInstancesSync)?.mock.calls.at(-1) ?? [];
        if (!onStorageKeysChanged || !onStorageKeysAnnounced) {
            throw new Error('Onyx.init did not subscribe to cross-tab sync');
        }
        deliverValuesFromOtherTab = onStorageKeysChanged;
        announceKeysFromOtherTab = onStorageKeysAnnounced;
        connections = [
            Onyx.connect({key: ONYX_KEYS.SESSION, callback: (value) => (sessionValue = value)}),
            Onyx.connect({key: `${ONYX_KEYS.COLLECTION.REPORT}1`, callback: (value) => (reportValue = value)}),
        ];
        return waitForPromisesToResolve();
    });

    afterEach(() => {
        for (const connection of connections) {
            connection.unsubscribe();
        }
        return Onyx.clear();
    });

    // Holds Onyx.clear() in its storage step, so the test can write while the clear is still running.
    function holdNextRemoveItems() {
        const removeItemsMock = jest.mocked(StorageMock.removeItems);
        const originalImplementation = removeItemsMock.getMockImplementation();
        removeItemsMock.mockImplementationOnce(
            (keys) =>
                new Promise((resolve) => {
                    finishRemoveItems = () => resolve(originalImplementation?.(keys));
                }),
        );
    }

    async function readAll(key: string, subscriberValue: unknown) {
        return {subscriber: subscriberValue, cache: cache.get(key), storage: await StorageMock.getItem(key)};
    }

    it('should keep a session another tab saved while this tab was clearing', async () => {
        // Given this tab holds the old session
        await Onyx.set(ONYX_KEYS.SESSION, OLD_SESSION);

        // When this tab starts its sign-out clear and another tab signs in meanwhile, saving the new session to shared
        // storage and announcing it, with the value reaching this tab before the clear ends
        holdNextRemoveItems();
        const clearPromise = Onyx.clear();
        await waitForPromisesToResolve();
        await StorageMock.setItem(ONYX_KEYS.SESSION, NEW_SESSION);
        announceKeysFromOtherTab([ONYX_KEYS.SESSION]);
        deliverValuesFromOtherTab([[ONYX_KEYS.SESSION, NEW_SESSION]]);
        await waitForPromisesToResolve();
        finishRemoveItems();
        await clearPromise;
        await waitForPromisesToResolve();

        // Then the clear doesn't overwrite the new session in storage, the cache or subscribers
        expect(await readAll(ONYX_KEYS.SESSION, sessionValue)).toEqual({subscriber: NEW_SESSION, cache: NEW_SESSION, storage: NEW_SESSION});
    });

    it('should read back a session another tab saved even when its value has not reached this tab yet', async () => {
        // Given this tab holds the old session
        await Onyx.set(ONYX_KEYS.SESSION, OLD_SESSION);

        // When another tab saves the new session during the clear, but only its key has arrived here so far,
        // as on web where the value is read from storage after the event
        holdNextRemoveItems();
        const clearPromise = Onyx.clear();
        await waitForPromisesToResolve();
        await StorageMock.setItem(ONYX_KEYS.SESSION, NEW_SESSION);
        announceKeysFromOtherTab([ONYX_KEYS.SESSION]);
        finishRemoveItems();
        await clearPromise;
        await waitForPromisesToResolve();

        // Then the clear leaves the new session in storage and gives it to the cache and subscribers
        expect(await readAll(ONYX_KEYS.SESSION, sessionValue)).toEqual({subscriber: NEW_SESSION, cache: NEW_SESSION, storage: NEW_SESSION});
    });

    it('should read back a collection member another tab saved while this tab was clearing', async () => {
        // Given this tab holds a report from the previous session
        await Onyx.set(`${ONYX_KEYS.COLLECTION.REPORT}1`, {reportID: 'old'});

        // When another tab saves the same report after the clear removed it from storage, but before the clear ends
        const multiSetMock = jest.mocked(StorageMock.multiSet);
        const originalMultiSet = multiSetMock.getMockImplementation();
        let finishMultiSet: () => void = () => {};
        multiSetMock.mockImplementationOnce(
            (pairs) =>
                new Promise((resolve) => {
                    finishMultiSet = () => resolve(originalMultiSet?.(pairs));
                }),
        );
        holdNextRemoveItems();
        const clearPromise = Onyx.clear();
        await waitForPromisesToResolve();
        finishRemoveItems();
        await waitForPromisesToResolve();
        await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.REPORT}1`, {reportID: 'new'});
        announceKeysFromOtherTab([`${ONYX_KEYS.COLLECTION.REPORT}1`]);
        finishMultiSet();
        await clearPromise;
        await waitForPromisesToResolve();

        // Then the report is not dropped from the cache or subscribers
        expect(await readAll(`${ONYX_KEYS.COLLECTION.REPORT}1`, reportValue)).toEqual({subscriber: {reportID: 'new'}, cache: {reportID: 'new'}, storage: {reportID: 'new'}});
    });

    it('should end with the default session when the other tab was signing out too', async () => {
        // Given this tab holds the old session
        await Onyx.set(ONYX_KEYS.SESSION, OLD_SESSION);

        // When another tab's own clear resets the session to its default during this tab's clear
        holdNextRemoveItems();
        const clearPromise = Onyx.clear();
        await waitForPromisesToResolve();
        await StorageMock.setItem(ONYX_KEYS.SESSION, DEFAULT_SESSION);
        announceKeysFromOtherTab([ONYX_KEYS.SESSION]);
        finishRemoveItems();
        await clearPromise;
        await waitForPromisesToResolve();

        // Then the session ends at its default everywhere, as with a single tab
        expect(await readAll(ONYX_KEYS.SESSION, sessionValue)).toEqual({subscriber: DEFAULT_SESSION, cache: DEFAULT_SESSION, storage: DEFAULT_SESSION});
    });
});
