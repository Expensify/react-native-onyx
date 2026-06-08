import * as Logger from '../../lib/Logger';
import StorageCircuitBreaker from '../../lib/StorageCircuitBreaker';

describe('StorageCircuitBreaker', () => {
    let currentTime = 1_000_000;
    let nowSpy: jest.SpyInstance;

    const advance = (ms: number) => {
        currentTime += ms;
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
        for (let i = 0; i < StorageCircuitBreaker.FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }

        expect(StorageCircuitBreaker.isTripped()).toBe(false);
    });

    it('should trip once capacity failures exceed the threshold within the window', () => {
        for (let i = 0; i <= StorageCircuitBreaker.FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }

        expect(StorageCircuitBreaker.isTripped()).toBe(true);
    });

    it('should not trip when failures are spread across multiple windows', () => {
        for (let i = 0; i <= StorageCircuitBreaker.FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
            // Space each failure out so older ones fall out of the rolling window before the count builds up.
            advance(2_000);
        }

        expect(StorageCircuitBreaker.isTripped()).toBe(false);
    });

    it('should trip after consecutive no-progress evictions', () => {
        // Each cycle is a capacity failure followed by an eviction that frees no usable space.
        for (let i = 0; i < StorageCircuitBreaker.NO_PROGRESS_CAP; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
            StorageCircuitBreaker.recordEviction();
        }
        // The next capacity failure observes that the last eviction made no progress, tipping it over.
        StorageCircuitBreaker.recordCapacityFailure();

        expect(StorageCircuitBreaker.isTripped()).toBe(true);
    });

    it('should not count a failure as no-progress when no eviction preceded it', () => {
        // Capacity failures with no interleaved evictions must not accumulate no-progress cycles.
        for (let i = 0; i < StorageCircuitBreaker.NO_PROGRESS_CAP + 2; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }

        expect(StorageCircuitBreaker.isTripped()).toBe(false);
    });

    it('should emit exactly one alert when it trips, even as failures continue', () => {
        const logAlertSpy = jest.spyOn(Logger, 'logAlert');

        for (let i = 0; i <= StorageCircuitBreaker.FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        // Further failures while open must not produce more alerts.
        StorageCircuitBreaker.recordCapacityFailure();
        StorageCircuitBreaker.recordCapacityFailure();

        expect(logAlertSpy).toHaveBeenCalledTimes(1);
        expect(logAlertSpy).toHaveBeenCalledWith(expect.stringContaining('Storage circuit breaker tripped'));
    });

    it('should self-reset once the rolling window clears', () => {
        for (let i = 0; i <= StorageCircuitBreaker.FAILURE_THRESHOLD; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
        }
        expect(StorageCircuitBreaker.isTripped()).toBe(true);

        advance(StorageCircuitBreaker.ROLLING_WINDOW_MS);

        expect(StorageCircuitBreaker.isTripped()).toBe(false);
    });

    it('should reset no-progress tracking after the window clears between storms', () => {
        // First storm: some no-progress evictions, but not enough to trip.
        for (let i = 0; i < StorageCircuitBreaker.NO_PROGRESS_CAP - 1; i++) {
            StorageCircuitBreaker.recordCapacityFailure();
            StorageCircuitBreaker.recordEviction();
        }

        // Let the window fully clear so the next failure starts a fresh storm.
        advance(StorageCircuitBreaker.ROLLING_WINDOW_MS + 1);
        StorageCircuitBreaker.recordCapacityFailure();

        expect(StorageCircuitBreaker.isTripped()).toBe(false);
    });
});
