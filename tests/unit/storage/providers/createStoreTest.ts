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
            expect(logAlertSpy).toHaveBeenCalledTimes(1);
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
            expect(logAlertSpy).not.toHaveBeenCalled();
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
            expect(logAlertSpy).not.toHaveBeenCalled();
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

            expect(logAlertSpy).toHaveBeenCalledWith('IDB InvalidStateError, retrying with fresh connection', {
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
            expect(logInfoSpy).toHaveBeenCalledWith('IDB heal: backing store error, attempting drop cached connection and reopen', expect.objectContaining({healAttemptsRemaining: 2}));
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

            // Budget exhausted — 4th call should NOT attempt healing
            logInfoSpy.mockClear();
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('k')))).rejects.toThrow('Internal error opening backing store');
            expect(logInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('IDB heal'), expect.anything());
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
            logInfoSpy = jest.spyOn(Logger, 'logInfo');

            // QuotaExceededError
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
                throw new DOMException('Quota exceeded', 'QuotaExceededError');
            });
            await expect(store('readonly', (s) => IDB.promisifyRequest(s.get('key1')))).rejects.toThrow('Quota exceeded');

            expect(logInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('IDB heal'), expect.anything());
        });
    });
});
