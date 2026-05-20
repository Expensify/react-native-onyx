import * as IDB from 'idb-keyval';
import createStore from '../../../../lib/storage/providers/IDBKeyValProvider/createStore';
import * as Logger from '../../../../lib/Logger';

const STORE_NAME = 'teststore';
let testDbCounter = 0;

function uniqueDBName() {
    testDbCounter += 1;
    return `TestCreateStoreDB_${testDbCounter}`;
}

/**
 * Captures the internal IDBDatabase instance used by a store by intercepting
 * the first db.transaction() call.
 */
async function captureDB(store: ReturnType<typeof createStore>): Promise<IDBDatabase | undefined> {
    const captured: {db?: IDBDatabase} = {};
    const original = IDBDatabase.prototype.transaction;
    const spy = jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
        captured.db = this;
        spy.mockRestore();
        return original.apply(this, args);
    });
    await store('readonly', (s) => IDB.promisifyRequest(s.getAllKeys()));
    return captured.db;
}

describe('createStore', () => {
    let logAlertSpy: jest.SpyInstance;
    let logInfoSpy: jest.SpyInstance;

    beforeEach(() => {
        logAlertSpy = jest.spyOn(Logger, 'logAlert');
        logInfoSpy = jest.spyOn(Logger, 'logInfo');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('InvalidStateError retry', () => {
        it('should retry once and succeed when db.transaction throws InvalidStateError', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('initial', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount += 1;
                if (callCount === 1) {
                    throw new DOMException('The database connection is closing.', 'InvalidStateError');
                }
                return original.apply(this, args);
            });

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));

            expect(result).toBe('initial');
            expect(callCount).toBe(2);
        });

        it('should propagate InvalidStateError if retry also fails', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
                throw new DOMException('The database connection is closing.', 'InvalidStateError');
            });

            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('key1')))).rejects.toThrow(DOMException);
            expect(logInfoSpy).toHaveBeenCalledWith(expect.stringContaining('IDB InvalidStateError'), expect.anything());
        });

        it('should not retry on non-InvalidStateError DOMException', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
                callCount += 1;
                throw new DOMException('Not found', 'NotFoundError');
            });

            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('key1')))).rejects.toThrow(DOMException);
            expect(callCount).toBe(1);
            expect(logAlertSpy).toHaveBeenCalledWith('IDB error is not recoverable, giving up', expect.objectContaining({errorMessage: 'Not found'}));
            expect(logAlertSpy).not.toHaveBeenCalledWith(expect.stringContaining('dropping cached connection'), expect.anything());
        });

        it('should not retry on non-DOMException errors', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
                callCount += 1;
                throw new TypeError('Something went wrong');
            });

            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('key1')))).rejects.toThrow(TypeError);
            expect(callCount).toBe(1);
            expect(logAlertSpy).toHaveBeenCalledWith('IDB error is not recoverable, giving up', expect.objectContaining({errorMessage: 'Something went wrong'}));
            expect(logAlertSpy).not.toHaveBeenCalledWith(expect.stringContaining('dropping cached connection'), expect.anything());
        });

        it('should preserve data integrity after a successful retry', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('existing', 'key0');
                return IDB.promisifyRequest(s.transaction);
            });

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount += 1;
                if (callCount === 1) {
                    throw new DOMException('The database connection is closing.', 'InvalidStateError');
                }
                return original.apply(this, args);
            });

            await store('readwrite', (s) => {
                s.put('retried_value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            jest.restoreAllMocks();
            logAlertSpy = jest.spyOn(Logger, 'logAlert');

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('retried_value');
        });
    });

    describe('diagnostic logging', () => {
        it('should log alert with all diagnostic fields on retry', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount += 1;
                if (callCount === 1) {
                    throw new DOMException('The database connection is closing.', 'InvalidStateError');
                }
                return original.apply(this, args);
            });

            await store('readwrite', (s) => {
                s.put('value2', 'key2');
                return IDB.promisifyRequest(s.transaction);
            });

            expect(logInfoSpy).toHaveBeenCalledWith('IDB InvalidStateError — dropping cached connection and retrying', {
                dbName,
                storeName: STORE_NAME,
                txMode: 'readwrite',
                errorMessage: 'The database connection is closing.',
            });
        });
    });

    describe('onclose handler', () => {
        it('should log info when browser closes the connection', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            const db = await captureDB(store);
            expect(db).toBeDefined();
            db?.onclose?.call(db, new Event('close'));

            expect(logInfoSpy).toHaveBeenCalledWith('IDB connection closed by browser', {dbName, storeName: STORE_NAME});
        });

        it('should recover with a fresh connection after browser close', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const db = await captureDB(store);
            expect(db).toBeDefined();
            db?.onclose?.call(db, new Event('close'));

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
        });
    });

    describe('onversionchange handler', () => {
        it('should close connection and log when versionchange fires', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            const db = await captureDB(store);
            expect(db).toBeDefined();
            const closeSpy = jest.spyOn(db!, 'close');

            // @ts-expect-error -- our handler ignores the event argument
            db?.onversionchange?.call(db, new Event('versionchange'));

            expect(closeSpy).toHaveBeenCalled();
            expect(logInfoSpy).toHaveBeenCalledWith('IDB connection closing due to version change', {dbName, storeName: STORE_NAME});
        });

        it('should recover with a fresh connection after versionchange', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const db = await captureDB(store);
            expect(db).toBeDefined();
            // @ts-expect-error -- our handler ignores the event argument
            db?.onversionchange?.call(db, new Event('versionchange'));

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
        });
    });

    describe('backing store healing', () => {
        /**
         * Helper: creates a DOMException matching Chromium's backing store corruption error.
         */
        function backingStoreError() {
            return new DOMException('Internal error opening backing store for indexedDB.open.', 'UnknownError');
        }

        it('should heal mid-session by dropping cached connection and reopening', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount++;
                if (callCount === 1) {
                    throw backingStoreError();
                }
                return original.apply(this, args);
            });

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
            expect(callCount).toBe(2);
            expect(logInfoSpy).toHaveBeenCalledWith(
                'IDB heal: backing store error detected — dropping cached connection and reopening (2 attempts left)',
                expect.objectContaining({dbName: expect.any(String)}),
            );
            expect(logInfoSpy).toHaveBeenCalledWith('IDB heal: successfully recovered after backing store error', expect.objectContaining({dbName: expect.any(String)}));
        });

        it('should heal on init when indexedDB.open() rejects with UnknownError', async () => {
            const dbName = uniqueDBName();

            // Pre-create the DB with data
            const setupStore = createStore(dbName, STORE_NAME);
            await setupStore('readwrite', (s) => {
                s.put('persisted', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            // Fresh store instance (simulates app restart — dbp starts undefined)
            const store = createStore(dbName, STORE_NAME);

            // Mock indexedDB.open to fail twice, then succeed.
            // First failure: initial open in the first store() call.
            // Second failure: the heal retry's open in that same call — propagates error.
            // Third call (second store() invocation): succeeds, proving budget still has 1 left.
            const realOpen = indexedDB.open.bind(indexedDB);
            let openCallCount = 0;
            jest.spyOn(indexedDB, 'open').mockImplementation((name: string, version?: number) => {
                openCallCount++;
                if (openCallCount <= 2) {
                    const req = {} as IDBOpenDBRequest;
                    Promise.resolve().then(() => {
                        Object.defineProperty(req, 'error', {value: backingStoreError(), configurable: true});
                        req.onerror?.(new Event('error') as Event & {target: IDBOpenDBRequest});
                    });
                    return req;
                }
                return realOpen(name, version);
            });

            // First call: open fails, heal retry also fails — error propagates
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('key1')))).rejects.toThrow('Internal error opening backing store');

            // Second call: open succeeds (mock exhausted), heals
            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('persisted');
            expect(openCallCount).toBeGreaterThanOrEqual(3);
        });

        it('should stop healing after budget exhausts across multiple operations', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            // All opens fail permanently
            jest.spyOn(indexedDB, 'open').mockImplementation(() => {
                const req = {} as IDBOpenDBRequest;
                Promise.resolve().then(() => {
                    Object.defineProperty(req, 'error', {value: backingStoreError(), configurable: true});
                    req.onerror?.(new Event('error') as Event & {target: IDBOpenDBRequest});
                });
                return req;
            });

            // Each call consumes 1 heal attempt (initial fails, heal retry also fails, propagates)
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Internal error opening backing store');
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Internal error opening backing store');
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Internal error opening backing store');

            // Budget exhausted — 4th call should NOT attempt healing, but should log budget exhausted
            logAlertSpy.mockClear();
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Internal error opening backing store');
            expect(logAlertSpy).toHaveBeenCalledWith(expect.stringContaining('heal budget exhausted'), expect.anything());
            expect(logAlertSpy).not.toHaveBeenCalledWith(expect.stringContaining('dropping cached connection and reopening'), expect.anything());
        });

        it('should reset heal budget after a successful operation', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const original = IDBDatabase.prototype.transaction;

            // Drain budget to 1 remaining: fail twice, each heals successfully
            for (let i = 0; i < 2; i++) {
                let callCount = 0;
                const spy = jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                    callCount++;
                    if (callCount === 1) {
                        throw backingStoreError();
                    }
                    spy.mockRestore();
                    return original.apply(this, args);
                });
                await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            }

            // Clean success — resets budget to 3
            jest.restoreAllMocks();
            logInfoSpy = jest.spyOn(Logger, 'logInfo');
            await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));

            // Now fail 3 more times — all should still heal (proving budget was reset)
            for (let i = 0; i < 3; i++) {
                let callCount = 0;
                const spy = jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                    callCount++;
                    if (callCount === 1) {
                        throw backingStoreError();
                    }
                    spy.mockRestore();
                    return original.apply(this, args);
                });
                const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
                expect(result).toBe('value');
            }
        });

        it('should not attempt healing for non-backing-store errors', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            // UnknownError but different message
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
                throw new DOMException('Some other unknown error', 'UnknownError');
            });
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('key1')))).rejects.toThrow('Some other unknown error');

            jest.restoreAllMocks();
            logAlertSpy = jest.spyOn(Logger, 'logAlert');

            // QuotaExceededError
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
                throw new DOMException('Quota exceeded', 'QuotaExceededError');
            });
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('key1')))).rejects.toThrow('Quota exceeded');

            expect(logAlertSpy).not.toHaveBeenCalledWith(expect.stringContaining('dropping cached connection and reopening'), expect.anything());
            expect(logAlertSpy).toHaveBeenCalledWith('IDB error is not recoverable, giving up', expect.objectContaining({errorMessage: 'Quota exceeded'}));
        });
    });

    describe('connection lost healing', () => {
        function connectionLostError() {
            return new DOMException('Connection to Indexed Database server lost. Refresh the page to try again', 'UnknownError');
        }

        it('should heal by dropping cached connection and reopening', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount++;
                if (callCount === 1) {
                    throw connectionLostError();
                }
                return original.apply(this, args);
            });

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
            expect(callCount).toBe(2);
            expect(logInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('connection lost error detected — dropping cached connection and reopening'),
                expect.objectContaining({dbName: expect.any(String)}),
            );
            expect(logInfoSpy).toHaveBeenCalledWith('IDB heal: successfully recovered after connection lost error', expect.objectContaining({dbName: expect.any(String)}));
        });

        it('should stop healing after budget exhausts', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            // All transaction calls fail permanently with connection lost.
            // The heal path clears dbp and calls indexedDB.open() again — mock that to
            // also fail so fake-indexeddb doesn't deadlock waiting for the old connection
            // to close (same pattern as the backing store budget exhaustion test).
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
                throw connectionLostError();
            });
            jest.spyOn(indexedDB, 'open').mockImplementation(() => {
                const req = {} as IDBOpenDBRequest;
                Promise.resolve().then(() => {
                    Object.defineProperty(req, 'error', {value: connectionLostError(), configurable: true});
                    req.onerror?.(new Event('error') as Event & {target: IDBOpenDBRequest});
                });
                return req;
            });

            // Each call drains 1 heal attempt (initial fails, heal retry also fails)
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Connection to Indexed Database server lost');
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Connection to Indexed Database server lost');
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Connection to Indexed Database server lost');

            // Budget exhausted — 4th call should NOT attempt healing, but should log budget exhausted
            logAlertSpy.mockClear();
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Connection to Indexed Database server lost');
            expect(logAlertSpy).toHaveBeenCalledWith(expect.stringContaining('heal budget exhausted'), expect.anything());
            expect(logAlertSpy).not.toHaveBeenCalledWith(expect.stringContaining('dropping cached connection and reopening'), expect.anything());
        });

        it('should also heal "connection is closing" variant', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount++;
                if (callCount === 1) {
                    throw new DOMException('Connection is closing.', 'UnknownError');
                }
                return original.apply(this, args);
            });

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
            expect(callCount).toBe(2);
        });

        it('should share heal budget with backing store errors', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            // All transaction calls fail permanently, alternating error types.
            // The heal path clears dbp and calls indexedDB.open() again — mock that to
            // also fail so fake-indexeddb doesn't deadlock waiting for the old connection
            // to close.
            const txErrors = [
                new DOMException('Internal error opening backing store for indexedDB.open.', 'UnknownError'),
                connectionLostError(),
                new DOMException('Internal error opening backing store for indexedDB.open.', 'UnknownError'),
            ];
            let txErrorIndex = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
                const err = txErrors[Math.min(txErrorIndex, txErrors.length - 1)];
                txErrorIndex++;
                throw err;
            });
            jest.spyOn(indexedDB, 'open').mockImplementation(() => {
                const req = {} as IDBOpenDBRequest;
                Promise.resolve().then(() => {
                    Object.defineProperty(req, 'error', {
                        value: new DOMException('Internal error opening backing store for indexedDB.open.', 'UnknownError'),
                        configurable: true,
                    });
                    req.onerror?.(new Event('error') as Event & {target: IDBOpenDBRequest});
                });
                return req;
            });

            // 3 calls drain the budget (each call: fail + heal retry fail = 1 budget)
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow();
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow();
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow();

            // Budget exhausted — no more healing for either error type
            logAlertSpy.mockClear();
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow();
            expect(logAlertSpy).toHaveBeenCalledWith(expect.stringContaining('heal budget exhausted'), expect.anything());
            expect(logAlertSpy).not.toHaveBeenCalledWith(expect.stringContaining('dropping cached connection and reopening'), expect.anything());
        });
    });

    describe('visibilitychange probe', () => {
        function simulateVisibilityChange(state: string) {
            Object.defineProperty(document, 'visibilityState', {value: state, writable: true, configurable: true});
            document.dispatchEvent(new Event('visibilitychange'));
        }

        afterEach(() => {
            Object.defineProperty(document, 'visibilityState', {value: 'visible', writable: true, configurable: true});
        });

        it('should drop stale dbp when probe detects connection lost on foreground', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            simulateVisibilityChange('hidden');

            const original = IDBDatabase.prototype.transaction;
            let probeIntercepted = false;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                if (!probeIntercepted) {
                    probeIntercepted = true;
                    throw new DOMException('Connection to Indexed Database server lost. Refresh the page to try again', 'UnknownError');
                }
                return original.apply(this, args);
            });

            simulateVisibilityChange('visible');

            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });

            jest.restoreAllMocks();

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
            expect(logAlertSpy).toHaveBeenCalledWith(expect.stringContaining('IDB visibilitychange probe: stale connection detected'), expect.objectContaining({dbName: expect.any(String)}));
        });

        it('should not probe when no connection exists yet', async () => {
            const dbName = uniqueDBName();
            createStore(dbName, STORE_NAME);

            simulateVisibilityChange('hidden');
            simulateVisibilityChange('visible');

            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });

            // No probe log for this specific store (dbp was never set)
            expect(logInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('visibilitychange probe'), expect.objectContaining({dbName}));
        });

        it('should keep connection when probe succeeds', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            simulateVisibilityChange('hidden');
            simulateVisibilityChange('visible');

            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
            // Probe ran but found healthy connection — no stale connection alert
            expect(logAlertSpy).not.toHaveBeenCalledWith(expect.stringContaining('stale connection detected'), expect.anything());
            expect(logInfoSpy).toHaveBeenCalledWith(expect.stringContaining('connection is healthy'), expect.anything());
        });

        it('should drop dbp when probe throws InvalidStateError', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            simulateVisibilityChange('hidden');

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount++;
                if (callCount === 1) {
                    throw new DOMException('The database connection is closing.', 'InvalidStateError');
                }
                return original.apply(this, args);
            });

            simulateVisibilityChange('visible');

            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });

            jest.restoreAllMocks();

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
            expect(logAlertSpy).toHaveBeenCalledWith(expect.stringContaining('IDB visibilitychange probe: stale connection detected'), expect.objectContaining({dbName: expect.any(String)}));
        });
    });
});
