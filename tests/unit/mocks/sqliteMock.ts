/**
 * Mock for `react-native-nitro-sqlite` backed by `better-sqlite3`, enabling
 * Node-level integration tests against a real SQLite engine.
 *
 * Implements the NitroSQLite surface used by
 * `lib/storage/providers/SQLiteProvider.ts`:
 *   - open({name})
 *   - connection.execute(sql)
 *   - connection.executeAsync<T>(sql, params?)
 *   - connection.executeBatchAsync([{query, params}, ...])
 *
 * Result rows are shaped to match Nitro: `{rows: {_array, item, length}}`.
 */
import BetterSqlite3 from 'better-sqlite3';
import type {Database} from 'better-sqlite3';
import type {BatchQueryCommand, NitroSQLiteConnection, NitroSQLiteQueryResultRows, QueryResult, QueryResultRow, SQLiteQueryParams} from 'react-native-nitro-sqlite';

// `better-sqlite3` is declared as `export = Database` (CommonJS), so the type is
// derived from the default import's namespace rather than via a named type import.

const databases = new Map<string, Database>();

/**
 * Returns the named-placeholder identifiers (`:name`) in the order of first
 * occurrence within the SQL string. Returns null if the SQL uses only
 * positional placeholders (`?`).
 *
 * SQLiteProvider's `multiMerge` uses `:key` and `:value` (with `:value`
 * reused on the ON CONFLICT branch). NitroSQLite binds positional array
 * parameters to these names by first-occurrence order — we mirror that.
 */
function extractNamedParameterOrder(sql: string): string[] | null {
    const matches = sql.match(/:[A-Za-z_][A-Za-z0-9_]*/g);
    if (!matches) {
        return null;
    }
    const seen = new Set<string>();
    const order: string[] = [];
    for (const match of matches) {
        const name = match.slice(1);
        if (!seen.has(name)) {
            seen.add(name);
            order.push(name);
        }
    }
    return order;
}

function wrapRows<TRow extends QueryResultRow>(rowsArray: TRow[]): NitroSQLiteQueryResultRows<TRow> {
    return {
        _array: rowsArray,
        item: (index: number) => rowsArray[index],
        length: rowsArray.length,
    };
}

function prepareAndBind(database: Database, sql: string, parameters?: SQLiteQueryParams) {
    const namedOrder = extractNamedParameterOrder(sql);
    if (namedOrder) {
        // Map positional parameters array to named bindings object — NitroSQLite's
        // first-occurrence-order convention.
        const statement = database.prepare(sql);
        const bindings: Record<string, unknown> = {};
        for (let index = 0; index < namedOrder.length; index++) {
            bindings[namedOrder[index]] = parameters?.[index];
        }
        // `arguments` is a reserved identifier in strict-mode modules, so the binding is
        // named `boundArguments`.
        return {statement, boundArguments: [bindings] as const};
    }
    return {statement: database.prepare(sql), boundArguments: parameters ?? []};
}

type BatchQuery = {
    query: string;
    params?: SQLiteQueryParams;
};

/**
 * Expands batch commands the same way NitroSQLite does in `batchParamsToCommands`:
 * `params` is either one binding set for the query, or an array of binding sets
 * (same query executed once per row).
 */
function batchParamsToCommands(commands: BatchQueryCommand[]): BatchQuery[] {
    const expanded: BatchQuery[] = [];

    for (const command of commands) {
        const {query, params} = command;

        if (!params) {
            expanded.push({query});
            continue;
        }

        if (Array.isArray(params[0])) {
            for (const rowParams of params as SQLiteQueryParams[]) {
                expanded.push({query, params: rowParams});
            }
            continue;
        }

        expanded.push({query, params: params as SQLiteQueryParams});
    }

    return expanded;
}

function runOne<TRow extends QueryResultRow>(database: Database, sql: string, parameters?: SQLiteQueryParams): QueryResult<TRow> {
    // Multi-statement (CREATE TABLE; SELECT ...; etc.) — better-sqlite3 cannot
    // prepare more than one statement at a time. SQLiteProvider's init() issues
    // each statement separately, so this branch is rarely hit, but keep it
    // defensive.
    const semicolons = (sql.match(/;/g) ?? []).length;
    if (semicolons > 1 || (semicolons === 1 && !sql.trim().endsWith(';'))) {
        database.exec(sql);
        return {rowsAffected: 0} as QueryResult<TRow>;
    }

    const {statement, boundArguments} = prepareAndBind(database, sql, parameters);

    // better-sqlite3 exposes `statement.reader` = true for statements that produce
    // result columns (SELECT, read-only PRAGMAs). For setter PRAGMAs and DDL
    // it's false. This is the cleanest way to dispatch correctly.
    if (statement.reader) {
        const rows = statement.all(...(boundArguments as unknown[])) as TRow[];
        return {rows: wrapRows(rows), rowsAffected: 0} as QueryResult<TRow>;
    }

    const info = statement.run(...(boundArguments as unknown[]));
    return {rowsAffected: info.changes, insertId: Number(info.lastInsertRowid)} as QueryResult<TRow>;
}

function makeConnection(name: string): Pick<NitroSQLiteConnection, 'execute' | 'executeAsync' | 'executeBatchAsync' | 'close'> {
    let database = databases.get(name);
    if (!database) {
        database = new BetterSqlite3(':memory:');
        databases.set(name, database);
    }
    const connection = database;

    return {
        execute(sql, parameters) {
            return runOne(connection, sql, parameters);
        },

        executeAsync(sql, parameters) {
            try {
                return Promise.resolve(runOne(connection, sql, parameters));
            } catch (error) {
                return Promise.reject(error);
            }
        },

        executeBatchAsync(commands) {
            try {
                let total = 0;
                const expandedCommands = batchParamsToCommands(commands);

                connection.transaction(() => {
                    for (const command of expandedCommands) {
                        const {statement, boundArguments} = prepareAndBind(connection, command.query, command.params);
                        const info = statement.run(...(boundArguments as unknown[]));
                        total += info.changes;
                    }
                })();
                return Promise.resolve({rowsAffected: total});
            } catch (error) {
                return Promise.reject(error);
            }
        },

        close() {
            connection.close();
            databases.delete(name);
        },
    };
}

function open({name}: {name: string}) {
    return makeConnection(name);
}

/**
 * Test helper — wipe every in-memory DB between tests.
 */
function resetAllDatabases() {
    for (const database of databases.values()) {
        try {
            database.close();
        } catch {
            /* ignore */
        }
    }
    databases.clear();
}

export {open, resetAllDatabases};
