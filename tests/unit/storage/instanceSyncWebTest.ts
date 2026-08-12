import InstanceSync from '../../../lib/storage/InstanceSync/index.web';
import type StorageProvider from '../../../lib/storage/providers/types';
import waitForPromisesToResolve from '../../utils/waitForPromisesToResolve';

const SYNC_ONYX = 'SYNC_ONYX';

// Mirrors MAX_SYNC_PAYLOAD_LENGTH in lib/storage/InstanceSync/index.web.ts (not exported).
const MAX_SYNC_PAYLOAD_LENGTH = 1_000_000;

/** Returns the SYNC_ONYX payloads written to localStorage, in write order. */
function getSyncPayloads(setItemSpy: jest.SpyInstance): string[] {
    return setItemSpy.mock.calls.filter(([key]) => key === SYNC_ONYX).map(([, value]) => value as string);
}

describe('InstanceSync (web)', () => {
    let setItemSpy: jest.SpyInstance;

    beforeEach(() => {
        setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('event payload chunking', () => {
        it('emits a single event when the batch fits within the payload limit', () => {
            const keys = ['test_1', 'test_2', 'test_3'];
            InstanceSync.multiSet(keys);

            const payloads = getSyncPayloads(setItemSpy);
            expect(payloads).toHaveLength(1);
            expect(JSON.parse(payloads[0])).toEqual(keys);
        });

        it('splits a batch larger than the payload limit into multiple events without losing keys', () => {
            // Three keys of ~400k chars each: the first two fit in one payload, the third starts a new one.
            const keys = [1, 2, 3].map((i) => `test_${i}_${'x'.repeat(400_000)}`);
            InstanceSync.multiSet(keys);

            const payloads = getSyncPayloads(setItemSpy);
            expect(payloads).toHaveLength(2);
            for (const payload of payloads) {
                expect(payload.length).toBeLessThanOrEqual(MAX_SYNC_PAYLOAD_LENGTH);
            }

            // All keys must arrive, in order, with no duplicates.
            const receivedKeys = payloads.flatMap((payload) => JSON.parse(payload) as string[]);
            expect(receivedKeys).toEqual(keys);
        });

        it('emits an oversized single key as its own event instead of dropping it', () => {
            const hugeKey = `test_huge_${'x'.repeat(MAX_SYNC_PAYLOAD_LENGTH + 1000)}`;
            InstanceSync.multiSet([hugeKey]);

            const payloads = getSyncPayloads(setItemSpy);
            expect(payloads).toHaveLength(1);
            expect(JSON.parse(payloads[0])).toEqual([hugeKey]);
        });

        it('emits no event for an empty batch', () => {
            InstanceSync.multiSet([]);

            expect(getSyncPayloads(setItemSpy)).toHaveLength(0);
        });
    });

    describe('storage event parsing', () => {
        let onStorageKeysChanged: jest.Mock;
        let multiGet: jest.Mock;
        let storageEventHandler: (event: {key: string | null; newValue: string | null}) => void;

        beforeEach(() => {
            onStorageKeysChanged = jest.fn();
            multiGet = jest.fn((keys: string[]) => Promise.resolve(keys.map((key) => [key, `value_of_${key}`])));

            const addEventListenerSpy = jest.spyOn(global, 'addEventListener').mockImplementation(() => undefined);
            InstanceSync.init(onStorageKeysChanged, {multiGet} as unknown as StorageProvider<unknown>);

            const storageCall = addEventListenerSpy.mock.calls.find(([type]) => type === 'storage');
            storageEventHandler = storageCall?.[1] as unknown as typeof storageEventHandler;
            expect(storageEventHandler).toBeDefined();
        });

        it('parses a JSON-array payload as a batch of keys', async () => {
            storageEventHandler({key: SYNC_ONYX, newValue: JSON.stringify(['test_1', 'test_2'])});
            await waitForPromisesToResolve();

            expect(multiGet).toHaveBeenCalledWith(['test_1', 'test_2']);
            expect(onStorageKeysChanged).toHaveBeenCalledWith([
                ['test_1', 'value_of_test_1'],
                ['test_2', 'value_of_test_2'],
            ]);
        });

        it('treats a legacy raw-key payload as a single key for backwards compatibility', async () => {
            storageEventHandler({key: SYNC_ONYX, newValue: 'test_1'});
            await waitForPromisesToResolve();

            expect(multiGet).toHaveBeenCalledWith(['test_1']);
            expect(onStorageKeysChanged).toHaveBeenCalledWith([['test_1', 'value_of_test_1']]);
        });

        it('treats a raw key that parses as non-array JSON as a single key', async () => {
            // A key like "123" is valid JSON but not an array; the raw string must be kept as the key.
            storageEventHandler({key: SYNC_ONYX, newValue: '123'});
            await waitForPromisesToResolve();

            expect(multiGet).toHaveBeenCalledWith(['123']);
        });

        it('coalesces a burst of storage events into one multiGet and one dispatch', async () => {
            // A tab running an older bundle emits one event per key; the burst must collapse into one batch.
            storageEventHandler({key: SYNC_ONYX, newValue: 'test_1'});
            storageEventHandler({key: SYNC_ONYX, newValue: JSON.stringify(['test_2', 'test_3'])});
            storageEventHandler({key: SYNC_ONYX, newValue: 'test_2'});
            await waitForPromisesToResolve();

            expect(multiGet).toHaveBeenCalledTimes(1);
            expect(multiGet).toHaveBeenCalledWith(['test_1', 'test_2', 'test_3']);
            expect(onStorageKeysChanged).toHaveBeenCalledTimes(1);
            expect(onStorageKeysChanged).toHaveBeenCalledWith([
                ['test_1', 'value_of_test_1'],
                ['test_2', 'value_of_test_2'],
                ['test_3', 'value_of_test_3'],
            ]);
        });

        it('dispatches separate batches for separate bursts', async () => {
            storageEventHandler({key: SYNC_ONYX, newValue: 'test_1'});
            await waitForPromisesToResolve();
            storageEventHandler({key: SYNC_ONYX, newValue: 'test_2'});
            await waitForPromisesToResolve();

            expect(multiGet).toHaveBeenCalledTimes(2);
            expect(multiGet).toHaveBeenNthCalledWith(1, ['test_1']);
            expect(multiGet).toHaveBeenNthCalledWith(2, ['test_2']);
        });

        it('ignores storage events that are not SYNC_ONYX', async () => {
            storageEventHandler({key: 'someOtherKey', newValue: 'test_1'});
            storageEventHandler({key: SYNC_ONYX, newValue: null});
            await waitForPromisesToResolve();

            expect(multiGet).not.toHaveBeenCalled();
            expect(onStorageKeysChanged).not.toHaveBeenCalled();
        });
    });
});
