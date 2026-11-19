import Onyx from '../../lib';
import DeferredStorageWrites from '../../lib/DeferredStorageWrites';
import OnyxCache from '../../lib/OnyxCache';
import StorageMock from '../../lib/storage';

const ONYX_KEYS = {
    DERIVED: 'derived',
    PRESERVED_DERIVED: 'preservedDerived',
};

const setItemMock = jest.mocked(StorageMock.setItem);

function getStorageWritesFor(key: string): unknown[] {
    return setItemMock.mock.calls.filter(([writtenKey]) => writtenKey === key).map(([, value]): unknown => value);
}

describe('Onyx.set with deferStorageWrite', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYX_KEYS});
    });

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(async () => {
        await Onyx.clear();
        await jest.runOnlyPendingTimersAsync();
        jest.useRealTimers();
        setItemMock.mockClear();
    });

    it('updates the cache and subscribers right away but writes storage only after sets pause', async () => {
        // Given a subscriber of a key that is set with deferred storage writes
        const callback = jest.fn();
        const connection = Onyx.connect({key: ONYX_KEYS.DERIVED, callback});
        await jest.advanceTimersByTimeAsync(0);
        setItemMock.mockClear();

        // When the key is set three times in a burst
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 1}, {deferStorageWrite: true});
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 2}, {deferStorageWrite: true});
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 3}, {deferStorageWrite: true});
        await jest.advanceTimersByTimeAsync(0);

        // Then the cache and the subscriber already have the latest value, while nothing was written to storage yet
        expect(OnyxCache.get(ONYX_KEYS.DERIVED)).toEqual({version: 3});
        expect(callback).toHaveBeenLastCalledWith({version: 3}, ONYX_KEYS.DERIVED);
        expect(getStorageWritesFor(ONYX_KEYS.DERIVED)).toEqual([]);

        // Then once the delay passes, storage receives only the latest value, in a single write
        await jest.advanceTimersByTimeAsync(DeferredStorageWrites.DEFERRED_WRITE_DELAY_MS);
        expect(getStorageWritesFor(ONYX_KEYS.DERIVED)).toEqual([{version: 3}]);
        expect(await StorageMock.getItem(ONYX_KEYS.DERIVED)).toEqual({version: 3});
        connection.unsubscribe();
    });

    it('still writes storage at the maximum delay when sets never pause', async () => {
        // Given a key that is set with deferred storage writes more often than the delay, for longer than the maximum delay
        const setInterval = DeferredStorageWrites.DEFERRED_WRITE_DELAY_MS / 2;
        const setCount = Math.ceil(DeferredStorageWrites.DEFERRED_WRITE_MAX_DELAY_MS / setInterval) + 1;

        // When the key keeps changing without a pause
        for (let version = 1; version <= setCount; version++) {
            await Onyx.set(ONYX_KEYS.DERIVED, {version}, {deferStorageWrite: true});
            await jest.advanceTimersByTimeAsync(setInterval);
        }

        // Then storage was still written while the sets continued, so it does not fall behind for longer than the maximum delay
        expect(getStorageWritesFor(ONYX_KEYS.DERIVED).length).toBeGreaterThan(0);
    });

    it('lets a later regular set replace the pending deferred write', async () => {
        // Given a pending deferred write
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 1}, {deferStorageWrite: true});

        // When the key is then set without deferring
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 2});
        await jest.advanceTimersByTimeAsync(DeferredStorageWrites.DEFERRED_WRITE_MAX_DELAY_MS);

        // Then storage holds the regular set's value and the deferred write never ran
        expect(getStorageWritesFor(ONYX_KEYS.DERIVED)).toEqual([{version: 2}]);
        expect(DeferredStorageWrites.hasPendingWrite(ONYX_KEYS.DERIVED)).toBe(false);
    });

    it('does not write a value back after the key is removed', async () => {
        // Given a pending deferred write
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 1}, {deferStorageWrite: true});

        // When the key is removed before the write runs
        await Onyx.set(ONYX_KEYS.DERIVED, null);
        await jest.advanceTimersByTimeAsync(DeferredStorageWrites.DEFERRED_WRITE_MAX_DELAY_MS);

        // Then the removed value is not written back to storage
        expect(getStorageWritesFor(ONYX_KEYS.DERIVED)).toEqual([]);
        expect(await StorageMock.getItem(ONYX_KEYS.DERIVED)).toBeFalsy();
    });

    it('drops pending writes on clear, except for preserved keys', async () => {
        // Given pending deferred writes for a key clear removes and for a key clear preserves
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 1}, {deferStorageWrite: true});
        await Onyx.set(ONYX_KEYS.PRESERVED_DERIVED, {version: 1}, {deferStorageWrite: true});

        // When Onyx is cleared, e.g. on sign-out
        const clearPromise = Onyx.clear([ONYX_KEYS.PRESERVED_DERIVED]);
        await jest.advanceTimersByTimeAsync(DeferredStorageWrites.DEFERRED_WRITE_MAX_DELAY_MS);
        await clearPromise;

        // Then the cleared key's value is not written back, and the preserved key is still persisted
        expect(getStorageWritesFor(ONYX_KEYS.DERIVED)).toEqual([]);
        expect(await StorageMock.getItem(ONYX_KEYS.DERIVED)).toBeFalsy();
        expect(await StorageMock.getItem(ONYX_KEYS.PRESERVED_DERIVED)).toEqual({version: 1});
    });

    it('persists merges applied after a deferred set', async () => {
        // Given a pending deferred write
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 1}, {deferStorageWrite: true});

        // When the key is merged before the deferred write runs
        await Onyx.merge(ONYX_KEYS.DERIVED, {extra: true});
        await jest.advanceTimersByTimeAsync(DeferredStorageWrites.DEFERRED_WRITE_MAX_DELAY_MS);

        // Then storage ends with the merged value, not the older value the deferred set carried
        expect(await StorageMock.getItem(ONYX_KEYS.DERIVED)).toEqual({version: 1, extra: true});
    });
    it('keeps the newer cached value when a deferred write fails', async () => {
        // Given a deferred write whose storage write will fail
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 1}, {deferStorageWrite: true});
        setItemMock.mockRejectedValueOnce(new Error('write failed'));
        await jest.advanceTimersByTimeAsync(DeferredStorageWrites.DEFERRED_WRITE_DELAY_MS);

        // When the key is set again after the failure
        await Onyx.set(ONYX_KEYS.DERIVED, {version: 2}, {deferStorageWrite: true});
        await jest.advanceTimersByTimeAsync(DeferredStorageWrites.DEFERRED_WRITE_DELAY_MS);

        // Then the failure did not roll the cache back, and the next deferred write stored the newer value
        expect(OnyxCache.get(ONYX_KEYS.DERIVED)).toEqual({version: 2});
        expect(await StorageMock.getItem(ONYX_KEYS.DERIVED)).toEqual({version: 2});
    });
});
