import * as Logger from './Logger';

/**
 * Process-scoped circuit breaker for storage CAPACITY failures.
 *
 * The per-operation retry budget in `OnyxUtils.retryOperation` cannot stop a session-level storm:
 * each evict -> OnyxDerived recompute -> new write starts its own fresh budget, so a full disk or
 * exhausted quota can drive tens of thousands of evict+retry cycles that never make progress and
 * freeze the app. This breaker is the session-level brake — `retryOperation` consults it before
 * every eviction.
 *
 * It trips when EITHER:
 *  - capacity failures within {@link ROLLING_WINDOW_MS} exceed {@link FAILURE_THRESHOLD}, or
 *  - {@link NO_PROGRESS_CAP} consecutive evictions are each immediately followed by another capacity
 *    failure (the eviction freed nothing the next write could use — a no-progress cycle). This is a
 *    cheap proxy for `getDatabaseSize()`, which is costly and only reports origin-wide usage.
 *
 * On trip it emits exactly ONE alert and self-resets once the rolling window clears, so a persistent
 * condition produces at most one alert per window instead of one log line per failed write.
 */

/** Rolling window over which capacity failures are counted, and how long a trip stays open. */
const ROLLING_WINDOW_MS = 60 * 1000;

/** Capacity failures within the window above which the breaker trips (storm backstop). */
const FAILURE_THRESHOLD = 50;

/** Consecutive no-progress evictions (evict -> still capacity failure) above which the breaker trips. */
const NO_PROGRESS_CAP = 5;

let failureTimestamps: number[] = [];
let consecutiveNoProgressEvictions = 0;
let evictionAwaitingResult = false;
let trippedUntil = 0;

function reset(): void {
    failureTimestamps = [];
    consecutiveNoProgressEvictions = 0;
    evictionAwaitingResult = false;
    trippedUntil = 0;
}

/** Whether the breaker is currently open. Self-resets once the window since the trip has cleared. */
function isTripped(): boolean {
    if (trippedUntil === 0) {
        return false;
    }
    if (Date.now() >= trippedUntil) {
        reset();
        return false;
    }
    return true;
}

function trip(reason: string): void {
    trippedUntil = Date.now() + ROLLING_WINDOW_MS;
    Logger.logAlert(`Storage circuit breaker tripped: ${reason}. Halting eviction/retry for ${ROLLING_WINDOW_MS / 1000}s to stop a storage failure storm.`);
}

/**
 * Record a CAPACITY failure. Call once per capacity failure in `retryOperation`, BEFORE deciding
 * whether to evict; then check {@link isTripped} to decide whether to proceed.
 */
function recordCapacityFailure(): void {
    // While open, recording is a no-op: no extra timestamps, no second alert, and nothing to keep the
    // window from clearing. `isTripped()` self-resets here once the window has elapsed.
    if (isTripped()) {
        return;
    }

    const now = Date.now();
    failureTimestamps = failureTimestamps.filter((timestamp) => now - timestamp < ROLLING_WINDOW_MS);

    // A fresh storm (nothing left in the window) resets the no-progress tracking so a stale eviction
    // from an earlier, unrelated incident can't be miscounted as no-progress for this one.
    if (failureTimestamps.length === 0) {
        consecutiveNoProgressEvictions = 0;
        evictionAwaitingResult = false;
    }

    // We evicted on the previous cycle and we're back here with another capacity failure, so that
    // eviction freed no usable space.
    if (evictionAwaitingResult) {
        consecutiveNoProgressEvictions += 1;
        evictionAwaitingResult = false;
    }

    failureTimestamps.push(now);

    if (failureTimestamps.length > FAILURE_THRESHOLD) {
        trip(`${failureTimestamps.length} capacity failures within ${ROLLING_WINDOW_MS / 1000}s`);
        return;
    }
    if (consecutiveNoProgressEvictions >= NO_PROGRESS_CAP) {
        trip(`${consecutiveNoProgressEvictions} consecutive evictions freed no usable space`);
    }
}

/** Record that `retryOperation` just evicted a key, so the next capacity failure counts as no-progress. */
function recordEviction(): void {
    evictionAwaitingResult = true;
}

/**
 * Record that a storage write SUCCEEDED. If an eviction was awaiting its verdict, the eviction freed
 * usable space — so it must NOT later be miscounted as a no-progress cycle by the next capacity
 * failure. Clear the pending flag and reset the consecutive no-progress streak (a success breaks the
 * streak). No-op when no eviction is pending (the common case), so it's cheap to call on every write.
 */
function recordWriteSuccess(): void {
    if (!evictionAwaitingResult) {
        return;
    }
    evictionAwaitingResult = false;
    consecutiveNoProgressEvictions = 0;
}

const StorageCircuitBreaker = {recordCapacityFailure, recordEviction, recordWriteSuccess, isTripped, reset, ROLLING_WINDOW_MS, FAILURE_THRESHOLD, NO_PROGRESS_CAP};

export default StorageCircuitBreaker;
