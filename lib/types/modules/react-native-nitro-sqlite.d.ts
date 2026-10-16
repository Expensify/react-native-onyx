// Expose the native-free subpaths to TypeScript's legacy Node module resolver.
declare module 'react-native-nitro-sqlite/errors' {
    export {NitroSQLiteError, NitroSQLiteExceptionType} from 'react-native-nitro-sqlite';
}

declare module 'react-native-nitro-sqlite/mock' {
    import type {NitroSQLiteConnection, NitroSQLiteConnectionOptions} from 'react-native-nitro-sqlite';

    type MockConnection = Pick<
        NitroSQLiteConnection,
        'close' | 'delete' | 'execute' | 'executeAsync' | 'executeBatch' | 'executeBatchAsync' | 'prepare' | 'transaction'
    >;
    function open(options: NitroSQLiteConnectionOptions): MockConnection;
    const NitroSQLite: {open: typeof open};
    function resetAllDatabases(): void;

    export type {MockConnection};
    export {NitroSQLite, open, resetAllDatabases};
}
