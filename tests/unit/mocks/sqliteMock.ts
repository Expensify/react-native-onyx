/**
 * Mock for `react-native-nitro-sqlite` backed by `better-sqlite3`, enabling
 * Node-level integration tests against separate handles to a temporary SQLite file.
 *
 * Implements the NitroSQLite surface used by
 * `lib/storage/providers/SQLiteProvider.ts`:
 *   - open({name, connection?, readOnly?})
 *   - connection.execute(sql)
 *   - connection.executeAsync<T>(sql, params?)
 *   - connection.executeBatchAsync([{query, params}, ...])
 *   - connection.prepare(sql)
 *
 * Result rows are shaped to match Nitro: `{rows: {_array, item, length}}`.
 */
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import type {Database, Statement} from 'better-sqlite3';
import type {BatchQueryCommand, NitroSQLiteConnection, NitroSQLiteQueryResultRows, QueryResult, QueryResultRow, SQLiteQueryParams} from 'react-native-nitro-sqlite';

// `better-sqlite3` is declared as `export = Database` (CommonJS), so the type is
// derived from the default import's namespace rather than via a named type import.

type OpenOptions = {name: string; connection?: 'default' | 'independent'; readOnly?: boolean};

const databases = new Set<Database>();
const defaultConnectionNames = new Set<string>();
const openOptions: OpenOptions[] = [];
const asyncQueries: Array<{sql: string; readOnly: boolean}> = [];
const preparedQueries: string[] = [];
let databaseDirectory: string | undefined;
let scheduledAsyncExecutionDelay: {skip: number; until: Promise<void>} | undefined;

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

function prepareAndBind(database: Database, sql: BatchQueryCommand['query'], parameters?: BatchQueryCommand['params']) {
    const statement = database.prepare(sql);
    return {statement, boundArguments: getBoundArguments(sql, parameters)};
}

function getBoundArguments(sql: string, parameters?: BatchQueryCommand['params']) {
    const namedOrder = extractNamedParameterOrder(sql);
    if (namedOrder) {
        // Map positional parameters array to named bindings object — NitroSQLite's
        // first-occurrence-order convention.
        const bindings: Record<string, unknown> = {};
        for (let index = 0; index < namedOrder.length; index++) {
            bindings[namedOrder[index]] = parameters?.[index];
        }
        // `arguments` is a reserved identifier in strict-mode modules, so the binding is
        // named `boundArguments`.
        return [bindings];
    }
    return parameters ?? [];
}

/**
 * Expands batch commands the same way NitroSQLite does in `batchParamsToCommands`:
 * `params` is either one binding set for the query, or an array of binding sets
 * (same query executed once per row).
 */
function batchParamsToCommands(commands: BatchQueryCommand[]): BatchQueryCommand[] {
    const expanded: BatchQueryCommand[] = [];

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

    return runPrepared<TRow>(database.prepare(sql), sql, parameters);
}

function runPrepared<TRow extends QueryResultRow>(statement: Statement<unknown[]>, sql: string, parameters?: SQLiteQueryParams): QueryResult<TRow> {
    const boundArguments = getBoundArguments(sql, parameters);

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

function executeAsyncWithDelay<Result>(run: () => Result): Promise<Result> {
    const scheduledDelay = scheduledAsyncExecutionDelay;
    if (!scheduledDelay) {
        return Promise.resolve().then(run);
    }
    if (scheduledDelay.skip > 0) {
        scheduledDelay.skip--;
        return Promise.resolve().then(run);
    }
    scheduledAsyncExecutionDelay = undefined;
    return scheduledDelay.until.then(run);
}

function makeConnection({
    name,
    connection,
    readOnly = false,
}: OpenOptions): Pick<NitroSQLiteConnection, 'execute' | 'executeAsync' | 'executeBatchAsync' | 'prepare' | 'transaction' | 'close'> {
    if (connection !== 'independent' && defaultConnectionNames.has(name)) {
        throw new Error(`Database ${name} is already open`);
    }

    databaseDirectory ??= mkdtempSync(join(tmpdir(), 'onyx-sqlite-test-'));
    const database = new BetterSqlite3(join(databaseDirectory, name), {readonly: readOnly, fileMustExist: readOnly});
    databases.add(database);
    if (connection !== 'independent') {
        defaultConnectionNames.add(name);
    }
    openOptions.push({name, connection, readOnly});

    return {
        execute(sql, parameters) {
            return runOne(database, sql, parameters);
        },

        executeAsync(sql, parameters) {
            asyncQueries.push({sql, readOnly});
            return executeAsyncWithDelay(() => runOne(database, sql, parameters));
        },

        prepare(sql) {
            preparedQueries.push(sql);
            const statement = database.prepare(sql);
            let finalized = false;
            const execute = <TRow extends QueryResultRow>(parameters?: SQLiteQueryParams) => {
                if (finalized) {
                    throw new Error('Prepared statement is finalized');
                }
                return runPrepared<TRow>(statement, sql, parameters);
            };

            return {
                get isFinalized() {
                    return finalized;
                },
                execute,
                executeAsync<TRow extends QueryResultRow>(parameters?: SQLiteQueryParams) {
                    asyncQueries.push({sql, readOnly});
                    return executeAsyncWithDelay(() => execute<TRow>(parameters));
                },
                finalize() {
                    finalized = true;
                },
            };
        },

        async transaction(callback) {
            database.exec('BEGIN TRANSACTION');
            let finished = false;
            const commit = () => {
                const result = runOne(database, 'COMMIT');
                finished = true;
                return result;
            };
            const rollback = () => {
                const result = runOne(database, 'ROLLBACK');
                finished = true;
                return result;
            };

            try {
                const result = await callback({
                    execute: (sql, parameters) => runOne(database, sql, parameters),
                    executeAsync: (sql, parameters) => {
                        asyncQueries.push({sql, readOnly});
                        return executeAsyncWithDelay(() => runOne(database, sql, parameters));
                    },
                    commit,
                    rollback,
                });
                if (!finished) {
                    commit();
                }
                return result;
            } catch (error) {
                if (!finished) {
                    rollback();
                }
                throw error;
            }
        },

        executeBatchAsync(commands) {
            try {
                let total = 0;
                const expandedCommands = batchParamsToCommands(commands);

                database.transaction(() => {
                    for (const command of expandedCommands) {
                        const {statement, boundArguments} = prepareAndBind(database, command.query, command.params);
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
            database.close();
            databases.delete(database);
            if (connection !== 'independent') {
                defaultConnectionNames.delete(name);
            }
        },
    };
}

function open(options: OpenOptions) {
    return makeConnection(options);
}

function getOpenOptions() {
    return [...openOptions];
}

function getAsyncQueries() {
    return [...asyncQueries];
}

function getPreparedQueries() {
    return [...preparedQueries];
}

function delayNextAsyncExecution(until: Promise<void>) {
    scheduledAsyncExecutionDelay = {skip: 0, until};
}

function delayAsyncExecutionAfter(skip: number, until: Promise<void>) {
    scheduledAsyncExecutionDelay = {skip, until};
}

/**
 * Test helper — close every handle and remove the temporary database between tests.
 */
function resetAllDatabases() {
    for (const database of databases) {
        try {
            database.close();
        } catch {
            /* ignore */
        }
    }
    databases.clear();
    defaultConnectionNames.clear();
    openOptions.length = 0;
    asyncQueries.length = 0;
    preparedQueries.length = 0;
    scheduledAsyncExecutionDelay = undefined;
    if (databaseDirectory) {
        rmSync(databaseDirectory, {recursive: true, force: true});
        databaseDirectory = undefined;
    }
}

export {delayAsyncExecutionAfter, delayNextAsyncExecution, getAsyncQueries, getOpenOptions, getPreparedQueries, open, resetAllDatabases};
