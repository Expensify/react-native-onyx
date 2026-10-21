/** Verifies that a native database open failure leaves Onyx usable in memory. */
import {open} from 'react-native-nitro-sqlite';
import type * as NitroSQLiteErrors from 'react-native-nitro-sqlite/errors';
import storage from '../../../lib/storage';
import {StorageErrorClass} from '../../../lib/storage/errors';

jest.unmock('../../../lib/storage');
jest.mock('../../../lib/storage/platforms/index', () => require('../../../lib/storage/providers/SQLiteProvider'));
jest.mock('react-native-nitro-sqlite', () => ({
    open: jest.fn(() => {
        const {NitroSQLiteError, NitroSQLiteExceptionType} = jest.requireActual<typeof NitroSQLiteErrors>('react-native-nitro-sqlite/errors');
        throw new NitroSQLiteError(`[NativeNitroSQLiteException][${NitroSQLiteExceptionType.DatabaseCannotBeOpened}] Cannot create the database`);
    }),
}));

describe('SQLite storage initialization', () => {
    it('falls back to memory when the primary database cannot open', async () => {
        // Given a native database that cannot open.
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(storage.getStorageProvider().name).toBe('SQLiteProvider');

        try {
            // When Onyx initializes and a caller waits for stored keys.
            storage.init();
            await expect(storage.getAllKeys()).resolves.toEqual([]);

            // Then initialization completes and subsequent reads and writes work in memory.
            expect(storage.getStorageProvider().name).toBe('MemoryOnlyProvider');
            const openError = jest.mocked(open).mock.results[0].value;
            expect(storage.classifyError(openError)).toBe(StorageErrorClass.UNAVAILABLE);
            await storage.setItem('test', {value: 'available'});
            await expect(storage.getItem('test')).resolves.toEqual({value: 'available'});
        } finally {
            consoleError.mockRestore();
        }
    });
});
