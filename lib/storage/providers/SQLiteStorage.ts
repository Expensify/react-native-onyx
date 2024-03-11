/**
 * The SQLiteStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */
import type {BatchQueryResult} from 'react-native-quick-sqlite';
import {open} from 'react-native-quick-sqlite';
import {getFreeDiskStorage} from 'react-native-device-info';
import type StorageProvider from './types';
import utils from '../../utils';
import type {KeyList, KeyValuePairList} from './types';

const DB_NAME = 'OnyxDB';
const db = open({name: DB_NAME});

db.execute('CREATE TABLE IF NOT EXISTS keyvaluepairs (record_key TEXT NOT NULL PRIMARY KEY , valueJSON JSON NOT NULL) WITHOUT ROWID;');

// All of the 3 pragmas below were suggested by SQLite team.
// You can find more info about them here: https://www.sqlite.org/pragma.html
db.execute('PRAGMA CACHE_SIZE=-20000;');
db.execute('PRAGMA synchronous=NORMAL;');
db.execute('PRAGMA journal_mode=WAL;');

const provider: StorageProvider = {
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
        // Note: We use `ON CONFLICT DO UPDATE` here instead of `INSERT OR REPLACE INTO`
        // so the new JSON value is merged into the old one if there's an existing value
        const query = `INSERT INTO keyvaluepairs (record_key, valueJSON)
             VALUES (:key, JSON(:value))
             ON CONFLICT DO UPDATE
             SET valueJSON = JSON_PATCH(valueJSON, JSON(:value));
        `;

        const nonNullishPairs = pairs.filter((pair) => pair[1] !== undefined);
        const queryArguments = nonNullishPairs.map((pair) => {
            const value = JSON.stringify(pair[1]);
            return [pair[0], value];
        });

        return db.executeBatchAsync([[query, queryArguments]]);
    },
    mergeItem(key, changes) {
        return this.multiMerge([[key, changes]]) as Promise<BatchQueryResult>;
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

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    keepInstancesSync: () => {},
};

export default provider;
