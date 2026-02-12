/**
 * Native SQLite Storage Provider
 *
 * Implements the StorageProvider interface using react-native-nitro-sqlite.
 * This module is called from the Worklet Worker Runtime (background JS thread)
 * managed by NativeFlushWorker, NOT from the main thread.
 *
 * Uses synchronous APIs (execute, executeBatch) since the Worklet Worker Runtime
 * runs on a dedicated background thread where blocking is acceptable and avoids
 * unnecessary Promise overhead.
 */
import type {BatchQueryCommand, NitroSQLiteConnection} from 'react-native-nitro-sqlite';
import {enableSimpleNullHandling, open} from 'react-native-nitro-sqlite';
import {getFreeDiskStorage} from 'react-native-device-info';
import type {FastMergeReplaceNullPatch} from '../../../utils';
import utils from '../../../utils';
import type StorageProvider from '../types';
import type {StorageKeyList, StorageKeyValuePair} from '../types';
import * as Queries from '../SQLiteQueries';

// By default, NitroSQLite does not accept nullish values due to current limitations in Nitro Modules.
// This flag enables a feature in NitroSQLite that allows for nullish values to be passed to operations, such as "execute" or "executeBatch".
// Simple null handling can potentially add a minor performance overhead,
// since parameters and results from SQLite queries need to be parsed from and to JavaScript nullish values.
// https://github.com/margelo/react-native-nitro-sqlite#sending-and-receiving-nullish-values
enableSimpleNullHandling();

/**
 * The type of the key-value pair stored in the SQLite database
 * @property record_key - the key of the record
 * @property valueJSON - the value of the record in JSON string format
 */
type OnyxSQLiteKeyValuePair = {
    record_key: string;
    valueJSON: string;
};

/**
 * The result of the `PRAGMA page_size`, which gets the page size of the SQLite database
 */
type PageSizeResult = {
    page_size: number;
};

/**
 * The result of the `PRAGMA page_count`, which gets the page count of the SQLite database
 */
type PageCountResult = {
    page_count: number;
};

const DB_NAME = 'OnyxDB';

/**
 * Prevents the stringifying of the object markers.
 */
function objectMarkRemover(key: string, value: unknown) {
    if (key === utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK) return undefined;
    return value;
}

/**
 * Transforms the replace null patches into SQL queries to be passed to JSON_REPLACE.
 */
function generateJSONReplaceSQLQueries(key: string, patches: FastMergeReplaceNullPatch[]): string[][] {
    const queries = patches.map(([pathArray, value]) => {
        const jsonPath = `$.${pathArray.join('.')}`;
        return [jsonPath, JSON.stringify(value), key];
    });

    return queries;
}

const provider: StorageProvider<NitroSQLiteConnection | undefined> = {
    store: undefined,

    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'SQLiteProvider',
    /**
     * Initializes the storage provider
     */
    init() {
        provider.store = open({name: DB_NAME});

        provider.store.execute(Queries.CREATE_TABLE);

        // All of the 3 pragmas below were suggested by SQLite team.
        // You can find more info about them here: https://www.sqlite.org/pragma.html
        provider.store.execute(Queries.PRAGMA_CACHE_SIZE);
        provider.store.execute(Queries.PRAGMA_SYNCHRONOUS);
        provider.store.execute(Queries.PRAGMA_JOURNAL_MODE);
    },
    getItem(key) {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        const {rows} = provider.store.execute<OnyxSQLiteKeyValuePair>(Queries.GET_ITEM, [key]);
        if (!rows || rows.length === 0) {
            return Promise.resolve(null);
        }
        const result = rows.item(0);
        if (result == null) {
            return Promise.resolve(null);
        }
        return Promise.resolve(JSON.parse(result.valueJSON));
    },
    multiGet(keys) {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        const command = Queries.buildMultiGetQuery(keys.length);
        const {rows} = provider.store.execute<OnyxSQLiteKeyValuePair>(command, keys);
        // eslint-disable-next-line no-underscore-dangle
        const result = rows?._array.map((row) => [row.record_key, JSON.parse(row.valueJSON)]);
        return Promise.resolve((result ?? []) as StorageKeyValuePair[]);
    },
    setItem(key, value) {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        provider.store.execute(Queries.SET_ITEM, [key, JSON.stringify(value)]);
        return Promise.resolve();
    },
    multiSet(pairs) {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        const params = pairs.map((pair) => [pair[0], JSON.stringify(pair[1] === undefined ? null : pair[1])]);
        if (utils.isEmptyObject(params)) {
            return Promise.resolve();
        }
        provider.store.executeBatch([{query: Queries.MULTI_SET_ITEM, params}]);
        return Promise.resolve();
    },
    multiMerge(pairs) {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        const commands: BatchQueryCommand[] = [];

        const patchQueryArguments: string[][] = [];
        const replaceQueryArguments: string[][] = [];

        const nonNullishPairs = pairs.filter((pair) => pair[1] !== undefined);

        for (const [key, value, replaceNullPatches] of nonNullishPairs) {
            const changeWithoutMarkers = JSON.stringify(value, objectMarkRemover);
            patchQueryArguments.push([key, changeWithoutMarkers]);

            const patches = replaceNullPatches ?? [];
            if (patches.length > 0) {
                const queries = generateJSONReplaceSQLQueries(key, patches);

                if (queries.length > 0) {
                    replaceQueryArguments.push(...queries);
                }
            }
        }

        commands.push({query: Queries.MERGE_ITEM_PATCH, params: patchQueryArguments});
        if (replaceQueryArguments.length > 0) {
            commands.push({query: Queries.MERGE_ITEM_REPLACE, params: replaceQueryArguments});
        }

        provider.store.executeBatch(commands);
        return Promise.resolve();
    },
    mergeItem(key, change, replaceNullPatches) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly.
        return provider.multiMerge([[key, change, replaceNullPatches]]);
    },
    getAllKeys() {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        const {rows} = provider.store.execute<{record_key: string}>(Queries.GET_ALL_KEYS);
        // eslint-disable-next-line no-underscore-dangle
        const result = rows?._array.map((row) => row.record_key);
        return Promise.resolve((result ?? []) as StorageKeyList);
    },
    removeItem(key) {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        provider.store.execute(Queries.REMOVE_ITEM, [key]);
        return Promise.resolve();
    },
    removeItems(keys) {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        const query = Queries.buildRemoveItemsQuery(keys.length);
        provider.store.execute(query, keys);
        return Promise.resolve();
    },
    clear() {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        provider.store.execute(Queries.CLEAR, []);
        return Promise.resolve();
    },
    getDatabaseSize() {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        const pageSizeResult = provider.store.execute<PageSizeResult>(Queries.PRAGMA_PAGE_SIZE);
        const pageCountResult = provider.store.execute<PageCountResult>(Queries.PRAGMA_PAGE_COUNT);
        const pageSize = pageSizeResult.rows?.item(0)?.page_size ?? 0;
        const pageCount = pageCountResult.rows?.item(0)?.page_count ?? 0;

        return getFreeDiskStorage().then((bytesRemaining) => ({
            bytesUsed: pageSize * pageCount,
            bytesRemaining,
        }));
    },
};

export default provider;
export type {OnyxSQLiteKeyValuePair};
