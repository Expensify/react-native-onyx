/**
 * The SQLiteStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */
import {QuickSQLite} from 'react-native-quick-sqlite';
import _ from 'underscore';

const DB_NAME = 'Expensify-new-db';
QuickSQLite.open(DB_NAME);

QuickSQLite.execute(DB_NAME, 'CREATE TABLE IF NOT EXISTS magic_map (record_key TEXT NOT NULL PRIMARY KEY , valueJSON JSON NOT NULL) WITHOUT ROWID;');
QuickSQLite.execute(DB_NAME, 'PRAGMA CACHE_SIZE=-20000;');
QuickSQLite.execute(DB_NAME, 'PRAGMA SYNCHRONOUS=NORMAL;');
QuickSQLite.execute(DB_NAME, 'PRAGMA journal_mode=WAL;');

const provider = {
    /**
      * Get the value of a given key or return `null` if it's not available in storage
      * @param {String} key
      * @return {Promise<*>}
      */
    getItem(key) {
        return QuickSQLite.executeAsync(DB_NAME, 'SELECT record_key, valueJSON from magic_map where record_key=?;', [key]).then(({rows}) => {
            // eslint-disable-next-line no-underscore-dangle
            const result = rows._array[0];
            return JSON.parse(result.valueJSON);
        });
    },

    /**
      * Get multiple key-value pairs for the given array of keys in a batch
      * @param {String[]} keys
      * @return {Promise<Array<[key, value]>>}
      */
    multiGet(keys) {
        return QuickSQLite.executeAsync(DB_NAME, `SELECT record_key, valueJSON from magic_map where record_key IN (${new Array(keys.length).fill('?').join(',')});`, keys)
            .then(({rows}) => {
                // eslint-disable-next-line no-underscore-dangle
                const result = _.map(rows._array, row => [row.record_key, JSON.parse(row.valueJSON)]);
                return result;
            });
    },

    /**
      * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
      * @param {String} key
      * @param {*} value
      * @return {Promise<void>}
      */
    setItem(key, value) {
        return QuickSQLite.executeAsync(DB_NAME, 'REPLACE into magic_map (record_key, valueJSON) VALUES (?, ?);', [key, JSON.stringify(value)]);
    },

    /**
      * Stores multiple key-value pairs in a batch
      * @param {Array<[key, value]>} pairs
      * @return {Promise<void>}
      */
    multiSet(pairs) {
        const stringifiedPairs = _.map(pairs, pair => [
            pair[0],
            JSON.stringify(pair[1]),
        ]);
        return QuickSQLite.executeBatchAsync(DB_NAME, [['REPLACE into magic_map (record_key, valueJSON) VALUES (?, json(?));', stringifiedPairs]]);
    },

    /**
      * Multiple merging of existing and new values in a batch
      * @param {Array<[key, value]>} pairs
      * @return {Promise<void>}
      */
    multiMerge(pairs) {
        return QuickSQLite.executeBatchAsync(DB_NAME,
            [['INSERT into magic_map (record_key, valueJSON) VALUES (?, json(?)) ON CONFLICT DO UPDATE SET valueJSON = json_patch(valueJSON, json(?));',
                _.map(pairs, (pair) => {
                    const value = JSON.stringify(pair[1]);
                    return [pair[0], value, value];
                }),
            ]]);
    },

    /**
      * Returns all keys available in storage
      * @returns {Promise<String[]>}
      */
    getAllKeys: () => QuickSQLite.executeAsync(DB_NAME, 'SELECT record_key from magic_map;').then(({rows}) => {
        // eslint-disable-next-line no-underscore-dangle
        const result = _.map(rows._array, row => row.record_key);
        return result;
    }),

    /**
      * Removes given key and it's value from storage
      * @param {String} key
      * @returns {Promise<void>}
      */
    removeItem: key => QuickSQLite.executeAsync(DB_NAME, 'DELETE FROM magic_map where record_key=?;', [key]),

    /**
      * Clears absolutely everything from storage
      * @returns {Promise<void>}
      */
    clear: () => QuickSQLite.executeAsync(DB_NAME, 'DELETE FROM magic_map;', []),
};

export default provider;
