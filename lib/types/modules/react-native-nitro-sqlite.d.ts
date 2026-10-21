// Expose the native-free subpaths to TypeScript's legacy Node module resolver.
declare module 'react-native-nitro-sqlite/errors' {
    export {NitroSQLiteError, NitroSQLiteExceptionType} from 'react-native-nitro-sqlite';
}

declare module 'react-native-nitro-sqlite/mock' {
    // eslint-disable-next-line import/no-unresolved -- Legacy Node type resolution uses this declaration file outside package exports.
    export * from 'react-native-nitro-sqlite/lib/typescript/commonjs/mock';
}
