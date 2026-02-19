import {useCallback, useRef} from 'react';
import usePrevious from './usePrevious';

type UseSelectorEpochResult = {
    hasSelectorComputedForCurrentEpoch: boolean;
    markSelectorComputedForCurrentEpoch: () => void;
};

/**
 * Tracks selector freshness across async interleavings using generation epochs.
 *
 * Why:
 * - Selector reference can change while external-store callbacks are still in flight.
 * - Snapshot cache may otherwise return a value computed by an older selector generation.
 *
 * How:
 * - Increment epoch whenever selector reference changes.
 * - Mark epoch as computed only after caller evaluates selector for current snapshot input.
 * - Expose a boolean that tells caller whether current selector generation has already been computed.
 *
 * Usage pattern:
 * 1) If `hasSelectorComputedForCurrentEpoch` is false, bypass cache and recompute.
 * 2) After recompute, call `markSelectorComputedForCurrentEpoch()`.
 */
function useSelectorEpoch<TSelector>(selector: TSelector | null): UseSelectorEpochResult {
    const selectorEpochRef = useRef(0);
    const computedSelectorEpochRef = useRef(-1);
    const previousSelector = usePrevious(selector);

    if (previousSelector !== selector) {
        selectorEpochRef.current += 1;
    }

    const markSelectorComputedForCurrentEpoch = useCallback(() => {
        computedSelectorEpochRef.current = selectorEpochRef.current;
    }, []);

    return {
        hasSelectorComputedForCurrentEpoch: !selector || computedSelectorEpochRef.current === selectorEpochRef.current,
        markSelectorComputedForCurrentEpoch,
    };
}

export default useSelectorEpoch;
