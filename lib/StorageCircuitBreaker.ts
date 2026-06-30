import AbstractCircuitBreaker from './CircuitBreaker/AbstractCircuitBreaker';
import * as Logger from './Logger';

/** Rolling window over which capacity failures are counted, and how long a trip stays open. */
const ROLLING_WINDOW_MS = 60 * 1000;

/** Capacity failures within the window above which the breaker trips (storm backstop). */
const FAILURE_THRESHOLD = 50;

/** Consecutive no-progress evictions (evict -> still capacity failure) above which the breaker trips. */
const NO_PROGRESS_CAP = 5;

/**
 * Process-scoped circuit breaker for storage CAPACITY failures.
 *
 * The per-operation retry budget in `OnyxUtils.retryOperation` cannot stop a session-level storm:
 * each evict -> OnyxDerived recompute -> new write starts its own fresh budget, so a full disk or
 * exhausted quota can drive tens of thousands of evict+retry cycles that never make progress and
 * freeze the app. This breaker is the session-level brake — `retryOperation` consults it before
 * every eviction.
 *
 * It is ONE circuit (closed/open/half-open) fed by TWO failure-counting policies, both evaluated in
 * {@link recordFailureInClosed}. It trips when EITHER:
 *  - capacity failures within {@link ROLLING_WINDOW_MS} exceed {@link FAILURE_THRESHOLD}, or
 *  - {@link NO_PROGRESS_CAP} consecutive evictions are each immediately followed by another capacity
 *    failure (the eviction freed nothing the next write could use — a no-progress cycle). This is a
 *    cheap proxy for `getDatabaseSize()`, which is costly and only reports origin-wide usage.
 *
 * Keeping both policies inside a single state machine — rather than composing two independent breakers
 * — is deliberate: two breakers each with their own open/half-open/probe latch cannot share one
 * coherent circuit state without races (stranded half-open probes, storms uncounted while the other
 * probes, cross-contaminated counters).
 *
 * On trip it emits exactly ONE alert per incident (across reopen cycles). After {@link ROLLING_WINDOW_MS}
 * the circuit moves to half-open and admits a single eviction+retry probe; a successful probe closes
 * the circuit, a failed probe reopens it for another window.
 */
class StorageCircuitBreaker extends AbstractCircuitBreaker {
    /** Timestamps of capacity failures still inside the rolling window. */
    private failureTimestamps: number[] = [];

    /** Consecutive evictions that each failed to free usable space. */
    private consecutiveNoProgress = 0;

    /** Set when an eviction's retry is pending, so the next capacity failure counts as no-progress. */
    private evictionAwaitingResult = false;

    /** Guards the single alert per incident (the open→half-open→open cycle must not re-alert). */
    private hasTripped = false;

    constructor() {
        super({
            resetTimeoutMs: ROLLING_WINDOW_MS,
            onTrip: (reason) => this.handleTrip(reason),
            onClose: () => {
                this.hasTripped = false;
            },
        });
    }

    /**
     * Record a CAPACITY failure. Call once per capacity failure in `retryOperation`, BEFORE deciding
     * whether to evict. Returns `true` when the breaker is open and eviction must not proceed.
     */
    recordCapacityFailure(): boolean {
        // We only get here when isAllowed() admitted this caller. In half-open that means THIS is the
        // single recovery probe: the eviction+retry that follows is the actual test, so the capacity
        // failure that triggered it must not re-trip the circuit. Let it proceed; the probe's outcome
        // is the verdict — recordWriteSuccess (retry landed) closes, recordProbeFailure (retry failed,
        // re-entering retryOperation) reopens.
        if (this.peekState() === 'half-open') {
            return false;
        }
        return this.recordFailure();
    }

    /** Record that `retryOperation` just evicted a key, so the next capacity failure counts as no-progress. */
    recordEviction(): void {
        this.evictionAwaitingResult = true;
    }

    /**
     * Record that a storage write succeeded. Fires on EVERY successful write, so it must only act on the
     * one that carries capacity information: a write whose eviction was awaiting its verdict. Such a
     * success means an eviction's retry actually landed — usable space was freed. In half-open that is
     * the recovery probe succeeding (closes the circuit); in closed it clears the no-progress streak. A
     * plain write that happens to succeed proves nothing about capacity and is a no-op (the common case).
     */
    recordWriteSuccess(): void {
        if (!this.evictionAwaitingResult) {
            return;
        }
        this.recordSuccess();
    }

    /**
     * Record that the half-open recovery probe failed. `retryOperation` calls this when a write is
     * rejected while a probe is in flight — the storage is still full, so reopen for another window.
     * No-op while fully open (recordFailure short-circuits) and harmless while closed.
     */
    recordProbeFailure(): void {
        this.recordFailure();
    }

    /** Wipe all state back to a fresh closed circuit. Process-scoped, so reset between tests/sessions. */
    reset(): void {
        this.hardReset();
        this.hasTripped = false;
    }

    protected recordFailureInClosed(): string | null {
        const now = Date.now();
        this.failureTimestamps = this.failureTimestamps.filter((timestamp) => now - timestamp < ROLLING_WINDOW_MS);

        // A fresh storm (nothing left in the window) resets the no-progress tracking so a stale eviction
        // from an earlier, unrelated incident can't be miscounted as no-progress for this one.
        if (this.failureTimestamps.length === 0) {
            this.consecutiveNoProgress = 0;
            this.evictionAwaitingResult = false;
        }

        // We evicted on the previous cycle and we're back here with another capacity failure, so that
        // eviction freed no usable space.
        if (this.evictionAwaitingResult) {
            this.consecutiveNoProgress += 1;
            this.evictionAwaitingResult = false;
        }

        this.failureTimestamps.push(now);

        if (this.failureTimestamps.length > FAILURE_THRESHOLD) {
            return `${this.failureTimestamps.length} capacity failures within ${ROLLING_WINDOW_MS / 1000}s`;
        }
        if (this.consecutiveNoProgress >= NO_PROGRESS_CAP) {
            return `${this.consecutiveNoProgress} consecutive evictions freed no usable space`;
        }
        return null;
    }

    protected recordSuccessInClosed(): void {
        // An eviction's retry succeeded: the eviction made progress, so break the no-progress streak.
        this.consecutiveNoProgress = 0;
        this.evictionAwaitingResult = false;
    }

    protected resetFailureState(): void {
        this.failureTimestamps = [];
        this.consecutiveNoProgress = 0;
        this.evictionAwaitingResult = false;
    }

    private handleTrip(reason: string): void {
        if (this.hasTripped) {
            return;
        }
        this.hasTripped = true;
        Logger.logAlert(`Storage circuit breaker tripped: ${reason}. Halting eviction/retry for ${ROLLING_WINDOW_MS / 1000}s to stop a storage failure storm.`);
    }
}

export default new StorageCircuitBreaker();
