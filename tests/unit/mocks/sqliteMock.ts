/**
 * Mock for `react-native-nitro-sqlite` backed by `better-sqlite3`, enabling
 * Node-level integration tests against a real SQLite engine.
 *
 * Implements the NitroSQLite surface used by
 * `lib/storage/providers/SQLiteProvider.ts`:
 *   - open({name})
 *   - enableSimpleNullHandling()
 *   - connection.execute(sql)
 *   - connection.executeAsync<T>(sql, params?)
 *   - connection.executeBatchAsync([{query, params}])
 *
 * Result rows are shaped to match Nitro: `{rows: {_array, item, length}}`.
 */
import BetterSqlite3 from 'better-sqlite3';
import type {Database} from 'better-sqlite3';

type Row = Record<string, unknown>;

type NitroRows<T> = {
    _array: T[];
    item: (index: number) => T | undefined;
    length: number;
};

type NitroResult<T> = {
    rows?: NitroRows<T>;
    rowsAffected: number;
    insertId?: number;
};

type BatchQueryCommand = {
    query: string;
    params?: unknown[][];
};

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

function wrapRows<T extends Row>(rowsArray: T[]): NitroRows<T> {
    return {
        _array: rowsArray,
        item: (index: number) => rowsArray[index],
        length: rowsArray.length,
    };
}

function prepareAndBind(database: Database, sql: string, parameters: unknown[]) {
    const namedOrder = extractNamedParameterOrder(sql);
    if (namedOrder) {
        // Map positional parameters array to named bindings object — NitroSQLite's
        // first-occurrence-order convention.
        const statement = database.prepare(sql);
        const bindings: Record<string, unknown> = {};
        for (let index = 0; index < namedOrder.length; index++) {
            bindings[namedOrder[index]] = parameters[index];
        }

        return {statement, boundArguments: [bindings] as const};
    }
    return {statement: database.prepare(sql), boundArguments: parameters};
}

function runOne<T extends Row>(database: Database, sql: string, parameters: unknown[] = []): NitroResult<T> {
    // Multi-statement (CREATE TABLE; SELECT ...; etc.) — better-sqlite3 cannot
    // prepare more than one statement at a time. SQLiteProvider's init() issues
    // each statement separately, so this branch is rarely hit, but keep it
    // defensive.
    const semicolons = (sql.match(/;/g) ?? []).length;
    if (semicolons > 1 || (semicolons === 1 && !sql.trim().endsWith(';'))) {
        database.exec(sql);
        return {rowsAffected: 0};
    }

    const {statement, boundArguments} = prepareAndBind(database, sql, parameters);

    // better-sqlite3 exposes `statement.reader` = true for statements that produce
    // result columns (SELECT, read-only PRAGMAs). For setter PRAGMAs and DDL
    // it's false. This is the cleanest way to dispatch correctly.
    if (statement.reader) {
        const rows = statement.all(...(boundArguments as unknown[])) as T[];
        return {rows: wrapRows(rows), rowsAffected: 0};
    }

    const info = statement.run(...(boundArguments as unknown[]));
    return {rowsAffected: info.changes, insertId: Number(info.lastInsertRowid)};
}

function makeConnection(name: string) {
    let database = databases.get(name);
    if (!database) {
        database = new BetterSqlite3(':memory:');
        databases.set(name, database);
    }
    const connection = database;

    return {
        execute<T extends Row = Row>(sql: string, parameters: unknown[] = []): NitroResult<T> {
            return runOne<T>(connection, sql, parameters);
        },

        executeAsync<T extends Row = Row>(sql: string, parameters: unknown[] = []): Promise<NitroResult<T>> {
            try {
                return Promise.resolve(runOne<T>(connection, sql, parameters));
            } catch (error) {
                return Promise.reject(error);
            }
        },

        executeBatchAsync(commands: BatchQueryCommand[]): Promise<{rowsAffected: number}> {
            try {
                let total = 0;
                connection.transaction(() => {
                    for (const command of commands) {
                        const namedOrder = extractNamedParameterOrder(command.query);
                        const statement = connection.prepare(command.query);
                        const parameterRows = command.params ?? [];
                        if (parameterRows.length === 0) {
                            const info = statement.run();
                            total += info.changes;
                            continue;
                        }
                        for (const row of parameterRows) {
                            if (namedOrder) {
                                const bindings: Record<string, unknown> = {};
                                for (let index = 0; index < namedOrder.length; index++) {
                                    bindings[namedOrder[index]] = row[index];
                                }
                                const info = statement.run(bindings);
                                total += info.changes;
                            } else {
                                const info = statement.run(...row);
                                total += info.changes;
                            }
                        }
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

function enableSimpleNullHandling() {
    // no-op; better-sqlite3 already handles null naturally.
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

export {open, enableSimpleNullHandling, resetAllDatabases};
