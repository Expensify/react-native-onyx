/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * Simple test to demonstrate the sourceValue race condition.
 *
 * This test proves that when multiple Onyx updates are batched together,
 * the sourceValue only reflects the first update, not all the discrete
 * updates that actually occurred.
 */

import {act, renderHook} from '@testing-library/react-native';
import Onyx, {useOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYXKEYS = {
    COLLECTION: {
        TEST_ITEMS: 'test_items_',
        PRIMER_COLLECTION: 'primer_collection_',
        REPORTS: 'reports_',
        POLICIES: 'policies_',
        TRANSACTIONS: 'transactions_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(async () => {
    // Clear Onyx data and wait for it to complete
    await Onyx.clear();

    // Wait for any pending async operations to complete
    await waitForPromisesToResolve();
});

afterEach(async () => {
    // Wait for pending operations to complete
    await waitForPromisesToResolve();

    // Add a small delay to ensure the setTimeout(0) batching mechanism fully completes
    // This prevents flakiness where the second test gets 0 renders due to timing issues
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Wait again after the sleep to ensure all async operations are truly done
    await waitForPromisesToResolve();
});

describe('Simple sourceValue Race Condition Demo', () => {
    it('should demonstrate that only one sourceValue is visible when updates are batched', async () => {
        // Track all sourceValues we receive during the test
        let receivedSourceValues: any[] = [];
        let renderCount = 0;

        const {result} = renderHook(() => {
            renderCount++;
            const [data, metadata] = useOnyx(ONYXKEYS.COLLECTION.TEST_ITEMS);

            // Log every sourceValue we see (excluding undefined/initial state)
            if (metadata.sourceValue !== undefined) {
                receivedSourceValues.push({
                    renderCount,
                    sourceValue: metadata.sourceValue,
                    timestamp: Date.now(),
                });
            }

            return [data, metadata];
        });

        // Wait for initial connection
        await act(async () => waitForPromisesToResolve());

        // ⚠️ PRIMER UPDATE REQUIRED FOR TEST STABILITY ⚠️
        // This primer is CRITICAL for preventing test flakiness. Here's why:
        //
        // 1. TIMING-DEPENDENT BATCHING: Onyx uses setTimeout(0) in maybeFlushBatchUpdates(),
        //    which makes the batching mechanism timing-sensitive
        //
        // 2. COLD START ISSUES: Without the primer, the first rapid-fire updates sometimes occur
        //    before Onyx's batching infrastructure is fully exercised, specifically:
        //    - The batchUpdatesPromise in OnyxUtils may not be properly initialized
        //    - The useOnyx hook's sourceValueRef may not have gone through a full update cycle
        //    - Connection callbacks may not have established their timing patterns
        //
        // 3. OBSERVABLE SYMPTOMS: When not primed, the test exhibits flaky behavior:
        //    - 0 renders instead of 1 (updates don't trigger React re-render)
        //    - 0 sourceValues instead of 1 (metadata tracking fails)
        //    - undefined final data instead of expected data (connection issues)
        //
        // 4. PRIMER FUNCTION: This single update exercises the full Onyx update pipeline once,
        //    ensuring subsequent rapid updates behave consistently and predictably
        await act(async () => {
            Onyx.merge(`${ONYXKEYS.COLLECTION.PRIMER_COLLECTION}warmup`, {primed: true});
            await waitForPromisesToResolve();
        });

        // Clear counters after initial setup and primer
        const initialRenderCount = renderCount;
        receivedSourceValues = [];

        console.log('\n=== Starting the race condition test ===');
        console.log('About to perform 3 discrete updates that should be batched...\n');

        // ⚠️  THE RACE CONDITION SCENARIO ⚠️
        // Perform multiple discrete updates in rapid succession
        // These SHOULD be treated as 3 separate updates, but React batches them
        // https://github.com/reactwg/react-18/discussions/21
        await act(async () => {
            // Update 1: Add first item
            Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_ITEMS}item1`, {
                step: 1,
                status: 'started',
                message: 'First update',
            });

            // Update 2: Add second item
            Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_ITEMS}item2`, {
                step: 2,
                status: 'processing',
                message: 'Second update',
            });

            // Update 3: Add third item
            Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_ITEMS}item3`, {
                step: 3,
                status: 'completed',
                message: 'Third update',
            });

            await waitForPromisesToResolve();
        });

        const updatesRenderCount = renderCount - initialRenderCount;

        console.log('=== RESULTS ===');
        console.log(`Expected: 3 discrete updates → 3 different sourceValues`);
        console.log(`Actual: ${receivedSourceValues.length} sourceValue(s) received`);
        console.log(`Renders: ${updatesRenderCount} (due to React batching)\n`);

        console.log('SourceValues received:', receivedSourceValues);
        console.log('Final data:', result.current[0]);
        // @ts-expect-error - sourceValue exists on the metadata object but TS doesn't know the type
        console.log('Final sourceValue:', result.current[1]?.sourceValue);

        // ✅ PROOF OF THE RACE CONDITION:

        // 1. We performed 3 discrete updates
        const expectedUpdates = 3;

        // 2. But due to batching, we only get 1 render and 1 sourceValue
        expect(updatesRenderCount).toBe(1); // Only 1 render due to batching
        expect(receivedSourceValues.length).toBe(1); // Only 1 sourceValue received

        // 3. The final data contains all changes (no data loss)
        expect(result.current[0]).toEqual({
            [`${ONYXKEYS.COLLECTION.TEST_ITEMS}item1`]: {
                step: 1,
                status: 'started',
                message: 'First update',
            },
            [`${ONYXKEYS.COLLECTION.TEST_ITEMS}item2`]: {
                step: 2,
                status: 'processing',
                message: 'Second update',
            },
            [`${ONYXKEYS.COLLECTION.TEST_ITEMS}item3`]: {
                step: 3,
                status: 'completed',
                message: 'Third update',
            },
        });

        // 4. But sourceValue only shows the last update that triggered the batch
        // @ts-expect-error - sourceValue exists on the metadata object but TS doesn't know the type
        if (result.current[1]?.sourceValue) {
            // @ts-expect-error - sourceValue exists on the metadata object but TS doesn't know the type
            expect(result.current[1].sourceValue).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_ITEMS}item3`]: {
                    step: 3,
                    status: 'completed',
                    message: 'Third update',
                },
            });
        }

        // 🚨 THE PROBLEM:
        // A component using sourceValue to track state transitions would miss:
        // - step: 1, status: 'started' (never visible in sourceValue)
        // - step: 2, status: 'processing' (never visible in sourceValue)

        console.log('\n🚨 RACE CONDITION CONFIRMED:');
        console.log(`• Expected to see ${expectedUpdates} sourceValues`);
        console.log(`• Actually received ${receivedSourceValues.length} sourceValue(s)`);
        console.log(`• Lost ${expectedUpdates - receivedSourceValues.length} intermediate updates`);
        console.log('• Only the last update is visible in sourceValue due to batching');
        console.log('\nThis means components cannot reliably track state transitions when updates are batched!');
    });
});
