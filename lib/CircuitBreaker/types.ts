/**
 * States of the circuit breaker.
 *
 * - **closed**: normal operation; requests flow and failures are counted.
 * - **open**: tripped; requests are rejected outright so a known-bad dependency isn't hammered.
 * - **half-open**: a trial state entered after the open timeout — see {@link CIRCUIT_BREAKER_TRANSITIONS}.
 */
type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Legal state transitions. The flow is closed → open → half-open → (closed | open).
 *
 * The **half-open** state exists so the breaker can test whether the dependency has recovered WITHOUT
 * flipping straight back to fully closed. Going open → closed blindly would, on a dependency that is
 * still down, immediately re-admit the full load and re-trip — flapping between open and closed every
 * window. Instead, after the open timeout the breaker moves to half-open and admits a single trial
 * ("probe") request:
 *  - probe succeeds → the dependency is healthy again → transition to **closed** (resume normal flow).
 *  - probe fails    → still broken → transition back to **open** for another timeout window.
 *
 * Admitting exactly one probe (rather than reopening the floodgates) is also what prevents the
 * "thundering herd": many callers retrying at once the instant the timeout elapses, re-overwhelming a
 * dependency that was just starting to recover.
 */
const CIRCUIT_BREAKER_TRANSITIONS = {
    closed: ['open'],
    open: ['half-open'],
    'half-open': ['closed', 'open'],
} as const satisfies Record<CircuitBreakerState, readonly CircuitBreakerState[]>;

type CircuitBreakerOptions = {
    /** Time in milliseconds the circuit stays open before moving to half-open. */
    resetTimeoutMs?: number;

    /** Called once each time the circuit opens. */
    onTrip?: (reason: string) => void;

    /** Called when the circuit closes. */
    onClose?: () => void;
};

export type {CircuitBreakerOptions, CircuitBreakerState};
export {CIRCUIT_BREAKER_TRANSITIONS};
