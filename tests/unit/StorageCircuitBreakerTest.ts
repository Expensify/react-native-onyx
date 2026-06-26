import * as Logger from '../../lib/Logger';
import StorageCircuitBreaker from '../../lib/StorageCircuitBreaker';

/** Mirror StorageCircuitBreaker tuning — tests assert behavior at these boundaries. */
const ROLLING_WINDOW_MS = 60_000;
const FAILURE_THRESHOLD = 50;
const NO_PROGRESS_CAP = 5;

describe('StorageCircuitBreaker', () => {
    let currentTime = 1_000_000;
    let nowSpy: jest.SpyInstance;

    const advance = (ms: number) => {
        currentTime += ms;
    };

    const expectAdmissionClosed = () => {
        expect(StorageCircuitBreaker.isAllowed()).toBe(true);
        expect(StorageCircuitBreaker.isAllowed()).toBe(true);
    };

    const expectAdmissionOpen = () => {
        expect(StorageCircuitBreaker.isAllowed()).toBe(false);
    };

    const expectAdmissionHalfOpen = () => {
        expect(StorageCircuitBreaker.isAllowed()).toBe(true);
        expect(StorageCircuitBreaker.isAllowed()).toBe(false);
    };

    beforeEach(() => {
        currentTime = 1_000_000;
        nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
        StorageCircuitBreaker.reset();
    });

    afterEach(() => {
        nowSpy.mockRestore();
        jest.restoreAllMocks();
    });

    it('should not trip below the failure threshold', () => {
        for (let i = 0; i < FAILURE_THRESHOLD; i++) {
            expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);
        }

        expectAdmissionClosed();
    });

    it('should trip once capacity failures exceed the threshold within the window', () => {
        for (let i = 0; i < FAILURE_THRESHOLD; i++) {
            expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);
        }

        expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(true);
        expectAdmissionOpen();
    });

    it('should not trip when failures are spread across multiple windows', () => {
        for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
            // Space each failure out so older ones fall out of the rolling window before the count builds up.
            advance(2_000);
        }

        expectAdmissionClosed();
    });

    it('should trip after consecutive no-progress evictions', () => {
        // Each cycle is a capacity failure followed by an eviction that frees no usable space.
        for (let i = 0; i < NO_PROGRESS_CAP; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
            StorageCircuitBreaker.recordEviction();
        }
        // The next capacity failure observes that the last eviction made no progress, tipping it over.
        expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(true);

        expectAdmissionOpen();
    });

    it('should not trip when each eviction makes progress (retry succeeds)', () => {
        // Intermittent quota pressure: every cycle is a capacity failure → eviction → SUCCESSFUL retry.
        // A successful retry means the eviction freed usable space, so it must never be counted as a
        // no-progress cycle by the next failure. Without recordWriteSuccess the stale pending flag made
        // each subsequent failure look like no-progress and tripped the breaker after NO_PROGRESS_CAP cycles.
        for (let i = 0; i < NO_PROGRESS_CAP + 3; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
            StorageCircuitBreaker.recordEviction();
            StorageCircuitBreaker.recordWriteSuccess();
        }

        expectAdmissionClosed();
    });

    it('should reset the no-progress streak when an eviction finally makes progress', () => {
        // A few no-progress evictions build the streak up, but short of the cap.
        for (let i = 0; i < NO_PROGRESS_CAP - 1; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
            StorageCircuitBreaker.recordEviction();
        }

        // This eviction succeeds, breaking the consecutive streak.
        StorageCircuitBreaker.recordCapacityFailure();
        StorageCircuitBreaker.recordEviction();
        StorageCircuitBreaker.recordWriteSuccess();

        // Two more no-progress cycles must not trip, because the streak was reset by the success above.
        StorageCircuitBreaker.recordCapacityFailure();
        StorageCircuitBreaker.recordEviction();
        expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);

        expectAdmissionClosed();
    });

    it('should not count a failure as no-progress when no eviction preceded it', () => {
        // Capacity failures with no interleaved evictions must not accumulate no-progress cycles.
        for (let i = 0; i < NO_PROGRESS_CAP + 2; i++) {
            expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);
        }

        expectAdmissionClosed();
    });

    it('should emit exactly one alert when it trips, even as failures continue', () => {
        const logAlertSpy = jest.spyOn(Logger, 'logAlert');

        for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        // Further failures while open must not produce more alerts.
        StorageCircuitBreaker.recordCapacityFailure();
        StorageCircuitBreaker.recordCapacityFailure();

        expect(logAlertSpy).toHaveBeenCalledTimes(1);
        expect(logAlertSpy).toHaveBeenCalledWith(expect.stringContaining('Storage circuit breaker tripped'));
    });

    it('should move to half-open once the open window clears', () => {
        for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        expectAdmissionOpen();

        advance(ROLLING_WINDOW_MS);

        expectAdmissionHalfOpen();
    });

    it('should admit only one capacity retry while half-open', () => {
        for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        advance(ROLLING_WINDOW_MS);

        expectAdmissionHalfOpen();
    });

    it('should let the half-open probe run its eviction+retry instead of re-tripping on the triggering failure', () => {
        for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        advance(ROLLING_WINDOW_MS);

        // The probe is driven by a capacity failure (the only thing that reaches retryOperation). That
        // triggering failure must NOT re-trip the breaker — it must let the eviction+retry proceed.
        expect(StorageCircuitBreaker.isAllowed()).toBe(true);
        expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);
    });

    it('should close the circuit when a half-open probe succeeds', () => {
        for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        advance(ROLLING_WINDOW_MS);

        // Drive the real probe sequence: admit → triggering capacity failure (lets the probe run) →
        // eviction → the retry succeeds. Only that eviction-retry success closes the circuit.
        expect(StorageCircuitBreaker.isAllowed()).toBe(true);
        expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);
        StorageCircuitBreaker.recordEviction();
        StorageCircuitBreaker.recordWriteSuccess();

        expectAdmissionClosed();
    });

    it('should not close a half-open circuit on an unrelated write that did not follow an eviction', () => {
        for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        advance(ROLLING_WINDOW_MS);

        // A plain write succeeding (no eviction awaiting its verdict) says nothing about capacity, so it
        // must not close the circuit. Half-open admits exactly one probe; a second admission stays gated.
        StorageCircuitBreaker.recordWriteSuccess();

        expectAdmissionHalfOpen();
    });

    it('should reopen when a half-open probe fails', () => {
        for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        advance(ROLLING_WINDOW_MS);

        // Admit the probe and let it run its eviction; the retry then fails, re-entering retryOperation
        // where the now-gated admission records the probe failure and reopens the circuit.
        expect(StorageCircuitBreaker.isAllowed()).toBe(true);
        expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);
        StorageCircuitBreaker.recordEviction();
        expect(StorageCircuitBreaker.isAllowed()).toBe(false);
        StorageCircuitBreaker.recordProbeFailure();

        expectAdmissionOpen();
    });

    it('should reset no-progress tracking after the window clears between storms', () => {
        // First storm: some no-progress evictions, but not enough to trip.
        for (let i = 0; i < NO_PROGRESS_CAP - 1; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
            StorageCircuitBreaker.recordEviction();
        }

        // Let the window fully clear so the next failure starts a fresh storm.
        advance(ROLLING_WINDOW_MS + 1);
        expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);

        expectAdmissionClosed();
    });

    describe('composition correctness', () => {
        // Simulate one capacity-failing write being driven through the breaker exactly as
        // `OnyxUtils.retryOperation` does: gate on isAllowed, then either drop (recording a probe
        // failure) or record the capacity failure and, if not tripped, evict and pair a retry verdict.
        type WriteOutcome = 'dropped' | 'tripped' | 'evicted';
        const failingCapacityWrite = (): WriteOutcome => {
            if (!StorageCircuitBreaker.isAllowed()) {
                StorageCircuitBreaker.recordProbeFailure();
                return 'dropped';
            }
            if (StorageCircuitBreaker.recordCapacityFailure()) {
                return 'tripped';
            }
            StorageCircuitBreaker.recordEviction();
            return 'evicted';
        };

        /** A capacity write whose eviction+retry then succeeds. */
        const recoveringCapacityWrite = () => {
            const outcome = failingCapacityWrite();
            if (outcome === 'evicted') {
                StorageCircuitBreaker.recordWriteSuccess();
            }
            return outcome;
        };

        /** Trip the no-progress policy via consecutive evictions that free nothing. Leaves it open. */
        const tripViaNoProgress = () => {
            for (let i = 0; i <= NO_PROGRESS_CAP; i++) {
                StorageCircuitBreaker.recordCapacityFailure();
                StorageCircuitBreaker.recordEviction();
            }
        };

        // Bug (a): both failure policies can be tripped, then both latch the half-open probe. A failed
        // probe reopens only one of them and strands the other half-open with its probe latched, so the
        // circuit can never admit again — a permanent deadlock that disables recovery for the session.
        it('should never permanently deadlock recovery, even after both failure policies trip', () => {
            // Trip the no-progress policy, then keep failing while open until the rolling policy trips too.
            tripViaNoProgress();
            for (let i = 0; i <= FAILURE_THRESHOLD; i++) {
                failingCapacityWrite();
            }
            expectAdmissionOpen();

            // A failed probe each window must still leave recovery possible the next window — forever.
            for (let window = 0; window < 3; window++) {
                advance(ROLLING_WINDOW_MS);
                expect(StorageCircuitBreaker.isAllowed()).toBe(true);
                // The admitted probe's eviction+retry fails, reopening the circuit.
                failingCapacityWrite();
                StorageCircuitBreaker.recordProbeFailure();
                expectAdmissionOpen();
            }

            // And a successful probe after all that must fully close the circuit.
            advance(ROLLING_WINDOW_MS);
            expect(recoveringCapacityWrite()).toBe('evicted');
            expectAdmissionClosed();
        });

        // Bug (b): a genuine high-rate storm must still stop eviction while the no-progress policy is
        // mid-recovery. After the single probe is admitted, the rest of the storm must be rejected.
        it('should keep rejecting a rate storm while recovering from a no-progress trip', () => {
            tripViaNoProgress();
            advance(ROLLING_WINDOW_MS);

            // First write is the admitted probe; the rest of the storm must all be dropped, not admitted.
            expect(failingCapacityWrite()).toBe('evicted');
            for (let i = 0; i < FAILURE_THRESHOLD; i++) {
                expect(failingCapacityWrite()).toBe('dropped');
            }
            expectAdmissionOpen();
        });

        // Bug (c): no-progress probe failures must not leak into the rolling-rate count. After several
        // recover→probe-fail cycles (each a single failure spread a full window apart), a later
        // sub-threshold burst of genuine rate failures must not be pushed over the edge by phantoms.
        it('should not leak no-progress probe failures into the rolling-window count', () => {
            tripViaNoProgress();
            for (let cycle = 0; cycle < 3; cycle++) {
                advance(ROLLING_WINDOW_MS);
                expect(StorageCircuitBreaker.isAllowed()).toBe(true);
                StorageCircuitBreaker.recordProbeFailure();
            }

            // Recover for real, then a sub-threshold burst of genuine rate failures must NOT trip.
            advance(ROLLING_WINDOW_MS);
            expect(recoveringCapacityWrite()).toBe('evicted');
            for (let i = 0; i < FAILURE_THRESHOLD; i++) {
                expect(StorageCircuitBreaker.recordCapacityFailure()).toBe(false);
            }
            expectAdmissionClosed();
        });
    });
});
