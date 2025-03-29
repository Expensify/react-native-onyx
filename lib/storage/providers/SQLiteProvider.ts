/**
 * The SQLiteStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */
import type {BatchQueryResult, QuickSQLiteConnection} from 'react-native-quick-sqlite';
import {open} from 'react-native-quick-sqlite';
import {getFreeDiskStorage} from 'react-native-device-info';
import type StorageProvider from './types';
import utils from '../../utils';
import type {KeyList, KeyValuePairList} from './types';

const DB_NAME = 'OnyxDB';
let db: QuickSQLiteConnection;

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
        return db.executeAsync('SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key = ?;', [key]).then(({rows}) => {
            if (!rows || rows?.length === 0) {
                return null;
            }
            const result = rows?.item(0);
            return JSON.parse(result.valueJSON);
        });
    },
    multiGet(keys) {
        const placeholders = keys.map(() => '?').join(',');
        const command = `SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
        return db.executeAsync(command, keys).then(({rows}) => {
            // eslint-disable-next-line no-underscore-dangle
            const result = rows?._array.map((row) => [row.record_key, JSON.parse(row.valueJSON)]);
            return (result ?? []) as KeyValuePairList;
        });
    },
    setItem(key, value) {
        return db.executeAsync('REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, ?);', [key, JSON.stringify(value)]);
    },
    multiSet(pairs) {
        const stringifiedPairs = pairs.map((pair) => [pair[0], JSON.stringify(pair[1] === undefined ? null : pair[1])]);
        if (utils.isEmptyObject(stringifiedPairs)) {
            return Promise.resolve();
        }
        return db.executeBatchAsync([['REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, json(?));', stringifiedPairs]]);
    },
    multiMerge(pairs) {
        const nonNullishPairs = pairs.filter((pair) => pair[1] !== undefined);
        const nonNullishPairsKeys = pairs.map((pair) => pair[0]);

        return this.multiGet(nonNullishPairsKeys).then((storagePairs) => {
            const newPairs: KeyValuePairList = [];
            for (let i = 0; i < storagePairs.length; i++) {
                const newPair = storagePairs[i];
                newPairs[i] = [newPair[0], utils.fastMerge(newPair[1] as Record<string, unknown>, nonNullishPairs[i][1] as Record<string, unknown>, true, false, true)];
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
        return Promise.all([db.executeAsync('PRAGMA page_size;'), db.executeAsync('PRAGMA page_count;'), getFreeDiskStorage()]).then(([pageSizeResult, pageCountResult, bytesRemaining]) => {
            const pageSize: number = pageSizeResult.rows?.item(0).page_size;
            const pageCount: number = pageCountResult.rows?.item(0).page_count;
            return {
                bytesUsed: pageSize * pageCount,
                bytesRemaining,
            };
        });
    },
};

export default provider;
