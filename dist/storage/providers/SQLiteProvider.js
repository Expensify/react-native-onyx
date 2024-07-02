"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_quick_sqlite_1 = require("react-native-quick-sqlite");
const react_native_device_info_1 = require("react-native-device-info");
const utils_1 = __importDefault(require("../../utils"));
const DB_NAME = 'OnyxDB';
let db;
const provider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'SQLiteProvider',
    /**
     * Initializes the storage provider
     */
    init() {
        db = (0, react_native_quick_sqlite_1.open)({ name: DB_NAME });
        db.execute('CREATE TABLE IF NOT EXISTS keyvaluepairs (record_key TEXT NOT NULL PRIMARY KEY , valueJSON JSON NOT NULL) WITHOUT ROWID;');
        // All of the 3 pragmas below were suggested by SQLite team.
        // You can find more info about them here: https://www.sqlite.org/pragma.html
        db.execute('PRAGMA CACHE_SIZE=-20000;');
        db.execute('PRAGMA synchronous=NORMAL;');
        db.execute('PRAGMA journal_mode=WAL;');
    },
    getItem(key) {
        return db.executeAsync('SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key = ?;', [key]).then(({ rows }) => {
            if (!rows || (rows === null || rows === void 0 ? void 0 : rows.length) === 0) {
                return null;
            }
            const result = rows === null || rows === void 0 ? void 0 : rows.item(0);
            return JSON.parse(result.valueJSON);
        });
    },
    multiGet(keys) {
        const placeholders = keys.map(() => '?').join(',');
        const command = `SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
        return db.executeAsync(command, keys).then(({ rows }) => {
            // eslint-disable-next-line no-underscore-dangle
            const result = rows === null || rows === void 0 ? void 0 : rows._array.map((row) => [row.record_key, JSON.parse(row.valueJSON)]);
            return (result !== null && result !== void 0 ? result : []);
        });
    },
    setItem(key, value) {
        return db.executeAsync('REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, ?);', [key, JSON.stringify(value)]);
    },
    multiSet(pairs) {
        const stringifiedPairs = pairs.map((pair) => [pair[0], JSON.stringify(pair[1] === undefined ? null : pair[1])]);
        if (utils_1.default.isEmptyObject(stringifiedPairs)) {
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
    mergeItem(key, deltaChanges, preMergedValue, shouldSetValue) {
        if (shouldSetValue) {
            return this.setItem(key, preMergedValue);
        }
        return this.multiMerge([[key, deltaChanges]]);
    },
    getAllKeys: () => db.executeAsync('SELECT record_key FROM keyvaluepairs;').then(({ rows }) => {
        // eslint-disable-next-line no-underscore-dangle
        const result = rows === null || rows === void 0 ? void 0 : rows._array.map((row) => row.record_key);
        return (result !== null && result !== void 0 ? result : []);
    }),
    removeItem: (key) => db.executeAsync('DELETE FROM keyvaluepairs WHERE record_key = ?;', [key]),
    removeItems: (keys) => {
        const placeholders = keys.map(() => '?').join(',');
        const query = `DELETE FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
        return db.executeAsync(query, keys);
    },
    clear: () => db.executeAsync('DELETE FROM keyvaluepairs;', []),
    getDatabaseSize() {
        return Promise.all([db.executeAsync('PRAGMA page_size;'), db.executeAsync('PRAGMA page_count;'), (0, react_native_device_info_1.getFreeDiskStorage)()]).then(([pageSizeResult, pageCountResult, bytesRemaining]) => {
            var _a, _b;
            const pageSize = (_a = pageSizeResult.rows) === null || _a === void 0 ? void 0 : _a.item(0).page_size;
            const pageCount = (_b = pageCountResult.rows) === null || _b === void 0 ? void 0 : _b.item(0).page_count;
            return {
                bytesUsed: pageSize * pageCount,
                bytesRemaining,
            };
        });
    },
};
exports.default = provider;
