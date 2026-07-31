import StateMachine from '../StateMachine';
import {CIRCUIT_BREAKER_TRANSITIONS} from './types';
import type {CircuitBreakerOptions, CircuitBreakerState} from './types';

/**
 * Generic circuit breaker built on {@link StateMachine}.
 *
 * - **closed**: requests are allowed; failures are counted.
 * - **open**: requests are rejected until {@link resetTimeoutMs} elapses.
 * - **half-open**: the recovery-probe state. After the open timeout, the breaker admits exactly ONE
 *   probe request: success means the dependency recovered, so the circuit closes. Failure means it's
 *   still down, so the circuit reopens. This single-request probe prevents a "thundering herd" where
 *   every caller fails loudly when the service hasn't recovered yet.
 *
 * Subclasses implement the failure-counting policy by overriding {@link recordFailureInClosed} (and
 * friends) — e.g. counting consecutive failures, or failures within a rolling time window, or any
 * combination of those.
 *
 * @example
 * class MyBreaker extends AbstractCircuitBreaker {
 *     private failures = 0;
 *     protected recordFailureInClosed() {
 *         this.failures += 1;
 *         return this.failures >= 3 ? `${this.failures} failures` : null;
 *     }
 *     protected recordSuccessInClosed() { this.failures = 0; }
 *     protected resetFailureState() { this.failures = 0; }
 * }
 *
 * const breaker = new MyBreaker({resetTimeoutMs: 30_000});
 * if (breaker.isAllowed()) {
 *     try {
 *         doWork();
 *         breaker.recordSuccess();
 *     } catch {
 *         breaker.recordFailure();
 *     }
 * }
 */
abstract class AbstractCircuitBreaker {
    private machine: StateMachine<typeof CIRCUIT_BREAKER_TRANSITIONS, CircuitBreakerState>;

    private openedAt = 0;

    private isProbeInFlight = false;

    private readonly resetTimeoutMs: number;

    private readonly onTrip?: (reason: string) => void;

    private readonly onClose?: () => void;

    constructor(options: CircuitBreakerOptions = {}) {
        this.resetTimeoutMs = options.resetTimeoutMs ?? 60_000;
        this.onTrip = options.onTrip;
        this.onClose = options.onClose;
        this.machine = new StateMachine('closed', CIRCUIT_BREAKER_TRANSITIONS);
    }

    /** Record a failure while the circuit is closed. Returns a trip reason when the threshold is exceeded. */
    protected abstract recordFailureInClosed(): string | null;

    /** Update failure state after a successful request while the circuit is closed. */
    protected abstract recordSuccessInClosed(): void;

    /** Clear accumulated failure state without changing circuit state. */
    protected abstract resetFailureState(): void;

    /**
     * Whether a request may proceed.
     *
     * Returns `false` while open. In half-open, the FIRST caller is admitted as the recovery probe and
     * `isProbeInFlight` is latched so every subsequent caller is rejected until that probe resolves
     * (via {@link recordSuccess} → close, or {@link recordFailure} → reopen). That single-probe gate is
     * the whole point of half-open: it tests recovery with one request instead of letting a herd of
     * waiting callers stampede a dependency that may still be down.
     */
    isAllowed(): boolean {
        const currentState = this.getCurrentState();

        if (currentState === 'open') {
            return false;
        }

        if (currentState === 'half-open') {
            if (this.isProbeInFlight) {
                return false;
            }
            this.isProbeInFlight = true;
        }

        return true;
    }

    /**
     * Record a failed request. May open the circuit from closed or half-open.
     * @returns `true` when the circuit is open after recording (the request must not proceed).
     */
    recordFailure(): boolean {
        if (this.machine.state === 'open') {
            return true;
        }

        if (this.machine.state === 'half-open') {
            this.trip();
            return true;
        }

        const reason = this.recordFailureInClosed();
        if (reason) {
            this.trip(reason);
            return true;
        }

        return false;
    }

    /** Record a successful request. Closes the circuit from half-open and clears failure counts. */
    recordSuccess(): void {
        if (this.machine.state === 'half-open') {
            this.close();
            return;
        }

        if (this.machine.state === 'closed') {
            this.recordSuccessInClosed();
        }
    }

    /**
     * The current state WITHOUT advancing recovery — a pure query, safe to call without side effects.
     * The open→half-open transition is applied only at the admission point ({@link isAllowed}); by the
     * time a caller queries state after being admitted, that transition has already happened.
     */
    peekState(): CircuitBreakerState {
        return this.machine.state;
    }

    /**
     * Force the circuit back to closed from ANY state. This is a reset, not a transition, so it
     * deliberately bypasses the transition graph (and does not fire {@link onClose}). Use only to wipe
     * all state — e.g. between tests or sessions.
     */
    protected hardReset(): void {
        this.machine = new StateMachine('closed', CIRCUIT_BREAKER_TRANSITIONS);
        this.openedAt = 0;
        this.isProbeInFlight = false;
        this.resetFailureState();
    }

    private getCurrentState(): CircuitBreakerState {
        this.maybeRecover();
        return this.machine.state;
    }

    private trip(reason = ''): void {
        if (this.machine.state === 'open') {
            return;
        }

        this.machine = this.machine.transition('open');
        this.openedAt = Date.now();
        this.isProbeInFlight = false;
        this.resetFailureState();
        this.onTrip?.(reason);
    }

    private close(): void {
        // close() only ever runs from half-open (see recordSuccess), and half-open → closed is the one
        // legal closing transition — so go through transition() to keep the illegal open → closed jump
        // an error rather than silently constructing a fresh closed machine.
        this.machine = this.machine.transition('closed');
        this.openedAt = 0;
        this.isProbeInFlight = false;
        this.resetFailureState();
        this.onClose?.();
    }

    /**
     * Lazily advance open → half-open once the reset timeout has elapsed. This is checked on read
     * (via {@link getCurrentState}) rather than on a timer, so there's nothing to schedule or clean up:
     * the transition simply becomes visible to the next caller after the window. Entering half-open
     * clears `isProbeInFlight` so the next admitted request becomes the recovery probe.
     */
    private maybeRecover(): void {
        if (this.machine.state !== 'open') {
            return;
        }

        if (Date.now() - this.openedAt < this.resetTimeoutMs) {
            return;
        }

        this.machine = this.machine.transition('half-open');
        this.isProbeInFlight = false;
    }
}

export default AbstractCircuitBreaker;
