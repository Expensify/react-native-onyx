/**
 * The SQLiteStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */
import type {BatchQueryResult, NitroSQLiteConnection} from 'react-native-nitro-sqlite';
import {enableSimpleNullHandling, open} from 'react-native-nitro-sqlite';
import {getFreeDiskStorage} from 'react-native-device-info';
import type StorageProvider from './types';
import utils from '../../utils';
import type {KeyList, KeyValuePairList} from './types';
import type {OnyxKey, OnyxValue} from '../../types';

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
let db: NitroSQLiteConnection;

const provider: StorageProvider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'SQLiteProvider',
    /**
     * Initializes the storage provider
     */
    init() {
        db = open({name: DB_NAME});

        db.execute('CREATE TABLE IF NOT EXISTS keyvaluepairs (record_key TEXT NOT NULL PRIMARY KEY , valueJSON JSON NOT NULL) WITHOUT ROWID;');

        // All of the 3 pragmas below were suggested by SQLite team.
        // You can find more info about them here: https://www.sqlite.org/pragma.html
        db.execute('PRAGMA CACHE_SIZE=-20000;');
        db.execute('PRAGMA synchronous=NORMAL;');
        db.execute('PRAGMA journal_mode=WAL;');
    },
    getItem(key) {
        return db.executeAsync<OnyxSQLiteKeyValuePair>('SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key = ?;', [key]).then(({rows}) => {
            if (!rows || rows?.length === 0) {
                return null;
            }
            const result = rows?.item(0);

            if (result == null) {
                return null;
            }

            return JSON.parse(result.valueJSON);
        });
    },
    multiGet(keys) {
        const placeholders = keys.map(() => '?').join(',');
        const command = `SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
        return db.executeAsync<OnyxSQLiteKeyValuePair>(command, keys).then(({rows}) => {
            // eslint-disable-next-line no-underscore-dangle
            const result = rows?._array.map((row) => [row.record_key, JSON.parse(row.valueJSON)]);
            return (result ?? []) as KeyValuePairList;
        });
    },
    setItem(key, value) {
        return db.executeAsync('REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, ?);', [key, JSON.stringify(value)]);
    },
    multiSet(pairs) {
        const query = 'REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, json(?));';
        const params = pairs.map((pair) => [pair[0], JSON.stringify(pair[1] === undefined ? null : pair[1])]);
        if (utils.isEmptyObject(params)) {
            return Promise.resolve();
        }
        return db.executeBatchAsync([{query, params}]);
    },
    multiMerge(pairs) {
        const nonNullishPairs: KeyValuePairList = [];
        const nonNullishPairsKeys: OnyxKey[] = [];

        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            if (pair[1] !== undefined) {
                nonNullishPairs.push(pair);
                nonNullishPairsKeys.push(pair[0]);
            }
        }

        if (nonNullishPairs.length === 0) {
            return Promise.resolve();
        }

        return this.multiGet(nonNullishPairsKeys).then((storagePairs) => {
            // multiGet() is not guaranteed to return the data in the same order we asked with "nonNullishPairsKeys",
            // so we use a map to associate keys to their existing values correctly.
            const existingMap = new Map<OnyxKey, OnyxValue<OnyxKey>>();
            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < storagePairs.length; i++) {
                existingMap.set(storagePairs[i][0], storagePairs[i][1]);
            }

            const newPairs: KeyValuePairList = [];

            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < nonNullishPairs.length; i++) {
                const key = nonNullishPairs[i][0];
                const newValue = nonNullishPairs[i][1];

                const existingValue = existingMap.get(key) ?? {};

                const mergedValue = utils.fastMerge(existingValue, newValue, true, false, true);

                newPairs.push([key, mergedValue]);
            }

            return this.multiSet(newPairs);
        });
    },
    mergeItem(key, preMergedValue) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly.
        return this.setItem(key, preMergedValue) as Promise<BatchQueryResult>;
    },
    getAllKeys: () =>
        db.executeAsync('SELECT record_key FROM keyvaluepairs;').then(({rows}) => {
            // eslint-disable-next-line no-underscore-dangle
            const result = rows?._array.map((row) => row.record_key);
            return (result ?? []) as KeyList;
        }),
    removeItem: (key) => db.executeAsync('DELETE FROM keyvaluepairs WHERE record_key = ?;', [key]),
    removeItems: (keys) => {
        const placeholders = keys.map(() => '?').join(',');
        const query = `DELETE FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
        return db.executeAsync(query, keys);
    },
    clear: () => db.executeAsync('DELETE FROM keyvaluepairs;', []),
    getDatabaseSize() {
        return Promise.all([db.executeAsync<PageSizeResult>('PRAGMA page_size;'), db.executeAsync<PageCountResult>('PRAGMA page_count;'), getFreeDiskStorage()]).then(
            ([pageSizeResult, pageCountResult, bytesRemaining]) => {
                const pageSize = pageSizeResult.rows?.item(0)?.page_size ?? 0;
                const pageCount = pageCountResult.rows?.item(0)?.page_count ?? 0;
                return {
                    bytesUsed: pageSize * pageCount,
                    bytesRemaining,
                };
            },
        );
    },
};

export default provider;
export type {OnyxSQLiteKeyValuePair};
