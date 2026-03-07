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
function captureDB(store: ReturnType<typeof createStore>): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve) => {
        const original = IDBDatabase.prototype.transaction;
        const spy = jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
            spy.mockRestore();
            resolve(this);
            return original.apply(this, args);
        });
        store('readonly', (s) => IDB.promisifyRequest(s.getAllKeys()));
    });
}

describe('createStore - connection resilience', () => {
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
                closedBy: 'unknown',
                errorMessage: 'The database connection is closing.',
            });
        });

        it('should log closedBy as "browser" when onclose preceded the error', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            const db = await captureDB(store);
            db.onclose!.call(db, new Event('close'));

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount += 1;
                if (callCount === 1) {
                    throw new DOMException('The database connection is closing.', 'InvalidStateError');
                }
                return original.apply(this, args);
            });

            await store('readonly', (s) => IDB.promisifyRequest(s.getAllKeys()));

            expect(logAlertSpy).toHaveBeenCalledWith('IDB InvalidStateError, retrying with fresh connection', expect.objectContaining({closedBy: 'browser'}));
        });

        it('should log closedBy as "versionchange" when onversionchange preceded the error', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            const db = await captureDB(store);
            // @ts-expect-error -- our handler ignores the event argument
            db.onversionchange!.call(db, new Event('versionchange'));

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount += 1;
                if (callCount === 1) {
                    throw new DOMException('The database connection is closing.', 'InvalidStateError');
                }
                return original.apply(this, args);
            });

            await store('readonly', (s) => IDB.promisifyRequest(s.getAllKeys()));

            expect(logAlertSpy).toHaveBeenCalledWith('IDB InvalidStateError, retrying with fresh connection', expect.objectContaining({closedBy: 'versionchange'}));
        });

        it('should reset closedBy to "unknown" after a retry', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            const db = await captureDB(store);
            db.onclose!.call(db, new Event('close'));

            const original = IDBDatabase.prototype.transaction;
            let callCount = 0;
            jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
                callCount += 1;
                if (callCount === 1) {
                    throw new DOMException('The database connection is closing.', 'InvalidStateError');
                }
                return original.apply(this, args);
            });

            // First operation triggers retry with closedBy: 'browser'
            await store('readonly', (s) => IDB.promisifyRequest(s.getAllKeys()));
            expect(logAlertSpy).toHaveBeenCalledWith('IDB InvalidStateError, retrying with fresh connection', expect.objectContaining({closedBy: 'browser'}));

            logAlertSpy.mockClear();

            // Force another InvalidStateError — closedBy should now be 'unknown'
            callCount = 0;

            await store('readonly', (s) => IDB.promisifyRequest(s.getAllKeys()));
            expect(logAlertSpy).toHaveBeenCalledWith('IDB InvalidStateError, retrying with fresh connection', expect.objectContaining({closedBy: 'unknown'}));
        });
    });

    describe('onclose handler', () => {
        it('should log info when browser closes the connection', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            const db = await captureDB(store);
            db.onclose!.call(db, new Event('close'));

            expect(logInfoSpy).toHaveBeenCalledWith('IDB connection closed by browser', {dbName, storeName: STORE_NAME});
        });

        it('should recover with a fresh connection after browser close', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const db = await captureDB(store);
            db.onclose!.call(db, new Event('close'));

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
        });
    });

    describe('onversionchange handler', () => {
        it('should close connection and log when versionchange fires', async () => {
            const dbName = uniqueDBName();
            const store = createStore(dbName, STORE_NAME);

            const db = await captureDB(store);
            const closeSpy = jest.spyOn(db, 'close');

            // @ts-expect-error -- our handler ignores the event argument
            db.onversionchange!.call(db, new Event('versionchange'));

            expect(closeSpy).toHaveBeenCalled();
            expect(logInfoSpy).toHaveBeenCalledWith('IDB connection closing due to versionchange', {dbName, storeName: STORE_NAME});
        });

        it('should recover with a fresh connection after versionchange', async () => {
            const store = createStore(uniqueDBName(), STORE_NAME);

            await store('readwrite', (s) => {
                s.put('value', 'key1');
                return IDB.promisifyRequest(s.transaction);
            });

            const db = await captureDB(store);
            // @ts-expect-error -- our handler ignores the event argument
            db.onversionchange!.call(db, new Event('versionchange'));

            const result = await store('readonly', (s) => IDB.promisifyRequest(s.get('key1')));
            expect(result).toBe('value');
        });
    });
});
