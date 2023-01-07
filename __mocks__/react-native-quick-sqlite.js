import _ from 'underscore';
import betterSqlite3 from 'better-sqlite3';

const db = betterSqlite3(':memory:');

/**
 * This mock is using a sqlite3 node package to create an in-memory database + replaces some react-native-quick-sqlite methods we are
 * using with equivalent node binding calls. react-native-quick-sqlite does not have built-in mocks so we created this to make sure
 * that our tests are at least using SQLite.
 */
const database = {
    /**
     * @param {Sting} query
     * @returns {Promise}
     */
    execute(query) {
        db.exec(query);
        return Promise.resolve();
    },

    /**
     * @param {String} query
     * @param {Array} params
     * @returns {Promise}
     */
    executeAsync(query, params = []) {
        const stmt = db.prepare(query);

        if (/SELECT/.test(query)) {
            const rows = stmt.all(params);
            return Promise.resolve({
                rows: {
                    _array: rows,
                    length: rows.length,
                    item(i) {
                        return rows[i];
                    },
                },
            });
        }

        if (/INSERT\sINTO/.test(query)) {
            stmt.run({
                key: params[0],
                value: params[1],
            });
            return Promise.resolve();
        }

        stmt.run(params);
        return Promise.resolve();
    },

    /**
     * @param {*} batch
     * @returns {Promise}
     */
    executeBatchAsync(batch) {
        const [query, pairs] = batch[0];
        const queries = [];
        _.each(pairs, (pair) => {
            queries.push(this.executeAsync(query, pair));
        });
        return Promise.all(queries);
    },
};

/**
 * @returns {Object}
 */
function open() {
    return database;
}

export {
    // eslint-disable-next-line import/prefer-default-export
    open,
};
