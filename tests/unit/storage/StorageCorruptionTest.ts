/* eslint-disable import/first */
jest.unmock('../../../lib/storage');
jest.unmock('../../../lib/storage/platforms/index');
jest.unmock('../../../lib/storage/providers/IDBKeyValProvider');

// React Native jest preset resolves platforms/index to platforms/index.native (SQLiteProvider).
// Force it to use IDBKeyValProvider for these tests.
jest.mock('../../../lib/storage/platforms/index.native', () => require('../../../lib/storage/providers/IDBKeyValProvider'));

import type {UseStore} from 'idb-keyval';
import type StorageModule from '../../../lib/storage';
import type IDBKeyValProviderModule from '../../../lib/storage/providers/IDBKeyValProvider';

// Each test gets fresh module instances to avoid shared state (e.g. degraded provider persisting).
let storage: typeof StorageModule;
let IDBKeyValProvider: typeof IDBKeyValProviderModule;

/**
 * Creates a DOMException that matches the real Chromium "Internal error opening backing store" error.
 */
function createBackingStoreError(): DOMException {
    return new DOMException('Internal error opening backing store for indexedDB.open.', 'UnknownError');
}

describe('Storage corruption detection and healing', () => {
    beforeEach(() => {
        jest.resetModules();
        storage = require('../../../lib/storage').default;
        IDBKeyValProvider = require('../../../lib/storage/providers/IDBKeyValProvider').default;
        storage.init();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Async error handling in tryOrDegradePerformance', () => {
        it('should catch async IDB rejections and degrade to MemoryOnlyProvider', async () => {
            await storage.setItem('test_key', {id: 'test_value'});
            expect(await storage.getItem('test_key')).toEqual({id: 'test_value'});

            // Replace the store function entirely — bypasses createStore's heal logic,
            // tests that tryOrDegradePerformance catches async rejections.
            IDBKeyValProvider.store = (() => Promise.reject(createBackingStoreError())) as unknown as UseStore;

            await expect(storage.setItem('key2', {id: 'value2'})).rejects.toThrow('Internal error opening backing store');
            expect(storage.getStorageProvider().name).toBe('MemoryOnlyProvider');
        });
    });

    describe('Corruption healing in createStore', () => {
        it('should detect corruption, delete the database, re-init, and recover', async () => {
            await storage.setItem('important_key', {id: 'important_value'});
            expect(await storage.getItem('important_key')).toEqual({id: 'important_value'});

            // Re-init to get a fresh createStore instance with dbp = undefined
            IDBKeyValProvider.init();

            // Mock indexedDB.open to fail once with backing store error, then work normally.
            // idb-keyval's promisifyRequest sets request.onsuccess/onerror as properties,
            // so we must trigger those callbacks, not dispatch DOM events.
            let openCallCount = 0;
            const realOpen = indexedDB.open.bind(indexedDB);
            const openSpy = jest.spyOn(indexedDB, 'open').mockImplementation((name: string, version?: number) => {
                openCallCount++;
                if (openCallCount <= 1) {
                    const req = {} as IDBOpenDBRequest;
                    Promise.resolve().then(() => {
                        Object.defineProperty(req, 'error', {value: createBackingStoreError(), configurable: true});
                        if (typeof req.onerror === 'function') {
                            req.onerror(new Event('error') as Event & {target: IDBOpenDBRequest});
                        }
                    });
                    return req;
                }
                openSpy.mockRestore();
                return realOpen(name, version);
            });

            const deleteDbSpy = jest.spyOn(indexedDB, 'deleteDatabase');

            await storage.setItem('new_key', {id: 'new_value'});

            expect(deleteDbSpy).toHaveBeenCalledWith('OnyxDB');

            const recovered = await storage.getItem('new_key');
            expect(recovered).toEqual({id: 'new_value'});
        });

        it('should degrade to MemoryOnlyProvider when healing fails', async () => {
            await storage.setItem('key1', {id: 'value1'});

            // All IDB operations fail permanently
            IDBKeyValProvider.store = (() => Promise.reject(createBackingStoreError())) as unknown as UseStore;

            // deleteDatabase also fails
            jest.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
                const req = {} as IDBOpenDBRequest;
                Promise.resolve().then(() => {
                    Object.defineProperty(req, 'error', {value: createBackingStoreError(), configurable: true});
                    if (typeof req.onerror === 'function') {
                        req.onerror(new Event('error') as Event & {target: IDBOpenDBRequest});
                    }
                });
                return req;
            });

            try {
                await storage.setItem('key2', {id: 'value2'});
            } catch {
                // Expected
            }

            // Subsequent operations should work via MemoryOnlyProvider
            await storage.setItem('memory_key', {id: 'memory_value'});
            expect(await storage.getItem('memory_key')).toEqual({id: 'memory_value'});
            expect(storage.getStorageProvider().name).toBe('MemoryOnlyProvider');
        });
    });

    describe('Error classification', () => {
        it('should only trigger corruption healing for backing store errors, not other IDB errors', async () => {
            await storage.setItem('key1', {id: 'value1'});

            // QuotaExceeded — not a backing store error
            IDBKeyValProvider.store = (() => Promise.reject(new DOMException('Quota exceeded', 'QuotaExceededError'))) as unknown as UseStore;

            const deleteDbSpy = jest.spyOn(indexedDB, 'deleteDatabase');

            try {
                await storage.setItem('key2', {id: 'value2'});
            } catch {
                // May or may not throw
            }

            expect(deleteDbSpy).not.toHaveBeenCalled();
            // Should NOT have degraded — QuotaExceeded is not a backing store error
            expect(storage.getStorageProvider().name).not.toBe('MemoryOnlyProvider');
        });
    });
});
