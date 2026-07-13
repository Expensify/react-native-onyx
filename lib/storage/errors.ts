/**
 * Shared vocabulary for storage write failures. The *classes* are engine-agnostic; the *matching*
 * is not — each storage provider knows its own error dialect and owns its classifier (see each
 * provider's `classifyError`). This module deliberately holds NO string matchers: it is the common
 * taxonomy the two reacting layers agree on, while the per-engine knowledge lives with the engine.
 *
 * - the connection layer (`createStore`) recovers TRANSIENT and FATAL errors by reopening the DB, and
 * - the operation layer (`OnyxUtils.retryOperation`) recovers CAPACITY by eviction and retries UNKNOWN.
 *
 * This module has no Onyx dependencies (and no engine dependencies) so it can live in the storage
 * layer, and be imported by every provider, without creating an import cycle.
 */
const StorageErrorClass = {
    /** Connection/transport failure (stale connection). Owner: connection layer — reopen + retry once. */
    TRANSIENT: 'transient',
    /** Quota exceeded / disk full. Owner: operation layer — evict and retry. */
    CAPACITY: 'capacity',
    /** Non-serializable payload. Never retriable — the same data will always fail. */
    INVALID_DATA: 'invalidData',
    /** Backing-store corruption. Owner: connection layer — budgeted heal, then give up. */
    FATAL: 'fatal',
    /** Unmatched by the active provider. Owner: operation layer — bounded retry, and log the shape so
     *  recurring cases can be promoted into one of the classes above. */
    UNKNOWN: 'unknown',
} as const;

/**
 * Serializes non-Error thrown values for classifier matching. JSON.stringify is preferred for plain
 * objects, but it throws on circular structures and returns undefined for BigInt/function/symbol, so
 * fall back to String() to keep normalization from throwing before classifyError runs.
 */
function serializeThrownValue(error: unknown): string {
    try {
        const serialized = JSON.stringify(error);
        if (serialized !== undefined) {
            return serialized;
        }
    } catch {
        // fall through to String()
    }
    return String(error);
}

/**
 * Normalizes any thrown value into a lowercased `{name, message}` pair for matching. Shared by every
 * provider's classifier so they all extract the error the same way.
 */
function getErrorParts(error: unknown): {name: string; message: string} {
    if (error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException)) {
        return {
            name: (error.name ?? '').toLowerCase(),
            message: (error.message ?? '').toLowerCase(),
        };
    }
    if (typeof error === 'string') {
        return {name: '', message: error.toLowerCase()};
    }
    if (error === null || error === undefined) {
        return {name: '', message: ''};
    }
    return {name: '', message: serializeThrownValue(error).toLowerCase()};
}

export {StorageErrorClass, getErrorParts};
