// Expose the native-free subpath to TypeScript's legacy Node module resolver.
declare module 'react-native-nitro-sqlite/errors' {
    export {NitroSQLiteError, NitroSQLiteExceptionType} from 'react-native-nitro-sqlite';
}
