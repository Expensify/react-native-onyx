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
    item: (i: number) => T | undefined;
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
 * params to these names by first-occurrence order — we mirror that.
 */
function extractNamedParamOrder(sql: string): string[] | null {
    const matches = sql.match(/:[A-Za-z_][A-Za-z0-9_]*/g);
    if (!matches) {
        return null;
    }
    const seen = new Set<string>();
    const order: string[] = [];
    for (const m of matches) {
        const name = m.slice(1);
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
        item: (i: number) => rowsArray[i],
        length: rowsArray.length,
    };
}

function prepareAndBind(db: Database, sql: string, params: unknown[]) {
    const namedOrder = extractNamedParamOrder(sql);
    if (namedOrder) {
        // Map positional params array to named bindings object — NitroSQLite's
        // first-occurrence-order convention.
        const stmt = db.prepare(sql);
        const bindings: Record<string, unknown> = {};
        for (let i = 0; i < namedOrder.length; i++) {
            bindings[namedOrder[i]] = params[i];
        }
        return {stmt, args: [bindings] as const};
    }
    return {stmt: db.prepare(sql), args: params};
}

function runOne<T extends Row>(db: Database, sql: string, params: unknown[] = []): NitroResult<T> {
    // Multi-statement (CREATE TABLE; SELECT ...; etc.) — better-sqlite3 cannot
    // prepare more than one statement at a time. SQLiteProvider's init() issues
    // each statement separately, so this branch is rarely hit, but keep it
    // defensive.
    const semicolons = (sql.match(/;/g) ?? []).length;
    if (semicolons > 1 || (semicolons === 1 && !sql.trim().endsWith(';'))) {
        db.exec(sql);
        return {rowsAffected: 0};
    }

    const {stmt, args} = prepareAndBind(db, sql, params);

    // better-sqlite3 exposes `stmt.reader` = true for statements that produce
    // result columns (SELECT, read-only PRAGMAs). For setter PRAGMAs and DDL
    // it's false. This is the cleanest way to dispatch correctly.
    if (stmt.reader) {
        const rows = stmt.all(...(args as unknown[])) as T[];
        return {rows: wrapRows(rows), rowsAffected: 0};
    }

    const info = stmt.run(...(args as unknown[]));
    return {rowsAffected: info.changes, insertId: Number(info.lastInsertRowid)};
}

function makeConnection(name: string) {
    let db = databases.get(name);
    if (!db) {
        db = new BetterSqlite3(':memory:');
        databases.set(name, db);
    }
    const conn = db;

    return {
        execute<T extends Row = Row>(sql: string, params: unknown[] = []): NitroResult<T> {
            return runOne<T>(conn, sql, params);
        },

        executeAsync<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<NitroResult<T>> {
            try {
                return Promise.resolve(runOne<T>(conn, sql, params));
            } catch (e) {
                return Promise.reject(e);
            }
        },

        executeBatchAsync(commands: BatchQueryCommand[]): Promise<{rowsAffected: number}> {
            try {
                let total = 0;
                conn.transaction(() => {
                    for (const command of commands) {
                        const namedOrder = extractNamedParamOrder(command.query);
                        const stmt = conn.prepare(command.query);
                        const paramRows = command.params ?? [];
                        if (paramRows.length === 0) {
                            const info = stmt.run();
                            total += info.changes;
                            continue;
                        }
                        for (const row of paramRows) {
                            if (namedOrder) {
                                const bindings: Record<string, unknown> = {};
                                for (let i = 0; i < namedOrder.length; i++) {
                                    bindings[namedOrder[i]] = row[i];
                                }
                                const info = stmt.run(bindings);
                                total += info.changes;
                            } else {
                                const info = stmt.run(...row);
                                total += info.changes;
                            }
                        }
                    }
                })();
                return Promise.resolve({rowsAffected: total});
            } catch (e) {
                return Promise.reject(e);
            }
        },

        close() {
            conn.close();
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
    for (const db of databases.values()) {
        try {
            db.close();
        } catch {
            /* ignore */
        }
    }
    databases.clear();
}

export {open, enableSimpleNullHandling, resetAllDatabases};
