import type * as LoggerModule from '../../../lib/Logger';
import type storageModule from '../../../lib/storage';
import {StorageErrorClass} from '../../../lib/storage/errors';

// `jestSetup.js` globally mocks `lib/storage`; this suite tests the real implementation.
jest.unmock('../../../lib/storage');

type Storage = typeof storageModule;
type Logger = typeof LoggerModule;
type LoggerCallback = Parameters<Logger['registerLogger']>[0];
type LogData = Parameters<LoggerCallback>[0];

type IsolatedModules = {
    storage: Storage;
    Logger: Logger;
};

type CapturedLog = {level: string; message: string};

/**
 * Load a fresh copy of `lib/storage` (and its `Logger` dependency) in an isolated
 * module registry so the module-private `provider` state in `lib/storage/index.ts`
 * does not leak between tests.
 */
function loadIsolatedStorage(): IsolatedModules {
    let storage!: Storage;
    let Logger!: Logger;

    jest.isolateModules(() => {
        Logger = require('../../../lib/Logger');
        storage = require('../../../lib/storage').default;
    });

    return {storage, Logger};
}

function noop() {
    // intentionally empty
}

describe('storage/tryOrDegradePerformance', () => {
    // Fake timers cause the init promise chain to hang.
    beforeAll(() => jest.useRealTimers());

    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        // `degradePerformance` calls `console.error` — silence it to keep test output clean.
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(noop);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('falls back to MemoryOnlyProvider when a storage op rejects asynchronously with "IDBKeyVal store could not be created"', async () => {
        const {storage, Logger} = loadIsolatedStorage();
        const capturedLogs: CapturedLog[] = [];
        Logger.registerLogger((data: LogData) => capturedLogs.push({level: data.level, message: data.message}));

        storage.init();

        const originalProvider = storage.getStorageProvider();
        const targetError = new Error('IDBKeyVal store could not be created');
        originalProvider.getAllKeys = jest.fn().mockReturnValue(Promise.reject(targetError));

        await expect(storage.getAllKeys()).rejects.toBe(targetError);

        expect(capturedLogs.some((log) => log.level === 'hmmm' && log.message.includes('Falling back to only using cache'))).toBe(true);
        expect(storage.getStorageProvider().name).toBe('MemoryOnlyProvider');
    });

    it('serializes Error.cause as a readable string in the degrade log', async () => {
        const {storage, Logger} = loadIsolatedStorage();
        const capturedLogs: CapturedLog[] = [];
        Logger.registerLogger((data: LogData) => capturedLogs.push({level: data.level, message: data.message}));

        storage.init();

        const originalProvider = storage.getStorageProvider();
        const targetError = new Error('IDBKeyVal store could not be created', {cause: new Error('underlying disk is full')});
        originalProvider.getAllKeys = jest.fn().mockReturnValue(Promise.reject(targetError));

        await expect(storage.getAllKeys()).rejects.toBe(targetError);

        const degradeLog = capturedLogs.find((log) => log.level === 'hmmm' && log.message.includes('Falling back to only using cache'));
        expect(degradeLog?.message).toContain('Cause: underlying disk is full');
        expect(degradeLog?.message).not.toContain('[object Object]');
    });

    it('should fall back to MemoryOnlyProvider when the active provider classifies the error as UNAVAILABLE', async () => {
        const {storage, Logger} = loadIsolatedStorage();
        const capturedLogs: CapturedLog[] = [];
        Logger.registerLogger((data: LogData) => capturedLogs.push({level: data.level, message: data.message}));

        storage.init();

        const originalProvider = storage.getStorageProvider();
        const targetError = new ReferenceError("Can't find variable: indexedDB");
        originalProvider.getAllKeys = jest.fn().mockReturnValue(Promise.reject(targetError));

        await expect(storage.getAllKeys()).rejects.toBe(targetError);

        expect(capturedLogs.some((log) => log.level === 'hmmm' && log.message.includes('Falling back to only using cache'))).toBe(true);
        expect(storage.getStorageProvider().name).toBe('MemoryOnlyProvider');
    });

    it('should still classify the error as UNAVAILABLE after degrading to MemoryOnlyProvider', async () => {
        const {storage} = loadIsolatedStorage();

        storage.init();

        const targetError = new ReferenceError("Can't find variable: indexedDB");
        storage.getStorageProvider().getAllKeys = jest.fn().mockReturnValue(Promise.reject(targetError));

        await expect(storage.getAllKeys()).rejects.toBe(targetError);

        // The degrade swaps the provider, but classification must keep working: `OnyxUtils.retryOperation`
        // classifies this same error afterwards to decide not to retry it.
        expect(storage.getStorageProvider().name).toBe('MemoryOnlyProvider');
        expect(storage.classifyError(targetError)).toBe(StorageErrorClass.UNAVAILABLE);
    });

    it('should stop rejecting after degrading, so a missing storage engine cannot produce a rejection loop', async () => {
        const {storage} = loadIsolatedStorage();

        storage.init();

        const originalProvider = storage.getStorageProvider();
        const targetError = new ReferenceError("Can't find variable: indexedDB");
        const getAllKeys = jest.fn().mockReturnValue(Promise.reject(targetError));
        originalProvider.getAllKeys = getAllKeys;

        await expect(storage.getAllKeys()).rejects.toBe(targetError);

        await expect(storage.getAllKeys()).resolves.toEqual([]);
        await expect(storage.getAllKeys()).resolves.toEqual([]);
        expect(getAllKeys).toHaveBeenCalledTimes(1);
    });

    it('propagates async rejections with unrelated messages without falling back', async () => {
        const {storage, Logger} = loadIsolatedStorage();
        const capturedLogs: CapturedLog[] = [];
        Logger.registerLogger((data: LogData) => capturedLogs.push({level: data.level, message: data.message}));

        storage.init();

        const originalProvider = storage.getStorageProvider();
        const originalProviderName = originalProvider.name;
        const unrelatedError = new Error('Some unrelated storage failure');
        originalProvider.getAllKeys = jest.fn().mockReturnValue(Promise.reject(unrelatedError));

        await expect(storage.getAllKeys()).rejects.toBe(unrelatedError);

        expect(capturedLogs.some((log) => log.level === 'hmmm' && log.message.includes('Falling back to only using cache'))).toBe(false);
        expect(storage.getStorageProvider().name).toBe(originalProviderName);
    });

    it('falls back to MemoryOnlyProvider when a storage op throws synchronously with "IDBKeyVal store could not be created"', async () => {
        const {storage, Logger} = loadIsolatedStorage();
        const capturedLogs: CapturedLog[] = [];
        Logger.registerLogger((data: LogData) => capturedLogs.push({level: data.level, message: data.message}));

        storage.init();

        const originalProvider = storage.getStorageProvider();
        const targetError = new Error('IDBKeyVal store could not be created');
        originalProvider.getAllKeys = jest.fn().mockImplementation(() => {
            throw targetError;
        });

        await expect(storage.getAllKeys()).rejects.toBe(targetError);

        expect(capturedLogs.some((log) => log.level === 'hmmm' && log.message.includes('Falling back to only using cache'))).toBe(true);
        expect(storage.getStorageProvider().name).toBe('MemoryOnlyProvider');
    });

    it('propagates sync throws with unrelated messages without falling back', async () => {
        const {storage, Logger} = loadIsolatedStorage();
        const capturedLogs: CapturedLog[] = [];
        Logger.registerLogger((data: LogData) => capturedLogs.push({level: data.level, message: data.message}));

        storage.init();

        const originalProvider = storage.getStorageProvider();
        const originalProviderName = originalProvider.name;
        const unrelatedError = new Error('Some unrelated storage failure');
        originalProvider.getAllKeys = jest.fn().mockImplementation(() => {
            throw unrelatedError;
        });

        await expect(storage.getAllKeys()).rejects.toBe(unrelatedError);

        expect(capturedLogs.some((log) => log.level === 'hmmm' && log.message.includes('Falling back to only using cache'))).toBe(false);
        expect(storage.getStorageProvider().name).toBe(originalProviderName);
    });
});
