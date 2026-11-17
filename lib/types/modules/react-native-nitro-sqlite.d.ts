// Expose the native-free errors subpath to TypeScript's legacy Node module resolver (used by tsconfig.build.json).
declare module 'react-native-nitro-sqlite/errors' {
    export {NitroSQLiteError, NitroSQLiteExceptionType} from 'react-native-nitro-sqlite';
}
