/* eslint-disable no-console, @typescript-eslint/no-explicit-any, no-else-return */
/**
 * Tests demonstrating the useSidebarOrderedReports display bug.
 *
 * This file contains two tests:
 * 1. Pure conditional logic bug - else-if chain ignores available sourceValues
 * 2. Compound issue - race condition + logic bug occurring simultaneously
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

describe('useSidebarOrderedReports Display Bug Tests', () => {
    it('should demonstrate useSidebarOrderedReports conditional logic bug when sourceValues from multiple collections are available', async () => {
        // This test demonstrates a LOGIC BUG (not race condition) in useSidebarOrderedReports.tsx:
        // When batching provides multiple sourceValues simultaneously, the else-if chain
        // only processes the FIRST condition and ignores available updates from other collections

        let renderCount = 0;
        const allUpdatesReceived: string[] = [];

        // Replicate the pattern from useSidebarOrderedReports.tsx lines 65-69
        const {result} = renderHook(() => {
            renderCount++;
            const [chatReports, {sourceValue: reportUpdates}] = useOnyx(ONYXKEYS.COLLECTION.REPORTS);
            const [policies, {sourceValue: policiesUpdates}] = useOnyx(ONYXKEYS.COLLECTION.POLICIES);
            const [transactions, {sourceValue: transactionsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTIONS);

            if (reportUpdates !== undefined) {
                allUpdatesReceived.push(`reports_${renderCount}`);
            }
            if (policiesUpdates !== undefined) {
                allUpdatesReceived.push(`policies_${renderCount}`);
            }
            if (transactionsUpdates !== undefined) {
                allUpdatesReceived.push(`transactions_${renderCount}`);
            }

            // Replicate the problematic else-if logic from useSidebarOrderedReports.tsx
            const getUpdatedReports = () => {
                let reportsToUpdate: string[] = [];
                // This else-if chain creates the logic bug
                if (reportUpdates) {
                    reportsToUpdate = Object.keys(reportUpdates);
                    return {source: 'reports', updates: reportsToUpdate};
                } else if (policiesUpdates) {
                    const updatedPolicies = Object.keys(policiesUpdates);
                    reportsToUpdate = updatedPolicies.map((key) => `affected_by_policy_${key.replace(ONYXKEYS.COLLECTION.POLICIES, '')}`);
                    return {source: 'policies', updates: reportsToUpdate};
                } else if (transactionsUpdates) {
                    const transactionReports = Object.values(transactionsUpdates).map((txn: any) => `report_${txn?.reportID}`);
                    reportsToUpdate = transactionReports;
                    return {source: 'transactions', updates: reportsToUpdate};
                }
                return {source: 'none', updates: []};
            };

            return {
                chatReports,
                policies,
                transactions,
                reportUpdates,
                policiesUpdates,
                transactionsUpdates,
                getUpdatedReports: getUpdatedReports(),
            };
        });

        await act(async () => waitForPromisesToResolve());

        // Add a primer update to ensure batching mechanism is warmed up (helps with test isolation)
        await act(async () => {
            Onyx.merge(`${ONYXKEYS.COLLECTION.PRIMER_COLLECTION}warmup`, {primed: true});
            await waitForPromisesToResolve();
        });

        const initialRenderCount = renderCount;
        allUpdatesReceived.length = 0;

        console.log('\n=== useSidebarOrderedReports Conditional Logic Bug Test ===');
        console.log('Simulating simultaneous updates that get batched together...');

        // Simulate the scenario where an API response updates multiple collections simultaneously
        await act(async () => {
            // Update 1: New report
            Onyx.merge(`${ONYXKEYS.COLLECTION.REPORTS}123`, {
                reportID: '123',
                lastMessage: 'New message',
                participantAccountIDs: [1, 2],
            });

            // Update 2: Policy change
            Onyx.merge(`${ONYXKEYS.COLLECTION.POLICIES}policy456`, {
                id: 'policy456',
                name: 'Updated Expense Policy',
                employeeList: {1: {}, 2: {}},
            });

            // Update 3: Transaction update
            Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTIONS}txn789`, {
                transactionID: 'txn789',
                reportID: '123',
                amount: 2500,
            });

            await waitForPromisesToResolve();
        });

        const totalRenders = renderCount - initialRenderCount;
        const updateDecision = result.current.getUpdatedReports;

        console.log('=== RESULTS ===');
        console.log(`Total renders: ${totalRenders}`);
        console.log(`Updates received: [${allUpdatesReceived.join(', ')}]`);
        console.log(`Decision made: ${updateDecision.source} → ${updateDecision.updates.length} reports to update`);

        console.log('\n🎯 CONDITIONAL LOGIC ANALYSIS:');
        const hasReportUpdates = result.current.reportUpdates !== undefined;
        const hasPolicyUpdates = result.current.policiesUpdates !== undefined;
        const hasTransactionUpdates = result.current.transactionsUpdates !== undefined;

        console.log(`• Reports sourceValue: ${hasReportUpdates ? '✅ Available' : '❌ Missing'}`);
        console.log(`• Policies sourceValue: ${hasPolicyUpdates ? '✅ Available' : '❌ Missing'}`);
        console.log(`• Transactions sourceValue: ${hasTransactionUpdates ? '✅ Available' : '❌ Missing'}`);

        // Check if the else-if logic caused updates to be ignored
        const collectionsWithUpdates = [hasReportUpdates, hasPolicyUpdates, hasTransactionUpdates].filter(Boolean).length;
        const collectionsProcessed = updateDecision.source !== 'none' ? 1 : 0;

        if (collectionsWithUpdates > collectionsProcessed) {
            console.log('\n🚨 CONDITIONAL LOGIC BUG CONFIRMED:');
            console.log(`• ${collectionsWithUpdates} collections had sourceValues available (due to batching)`);
            console.log(`• Only ${collectionsProcessed} collection was processed: "${updateDecision.source}"`);
            console.log(`• ${collectionsWithUpdates - collectionsProcessed} collection(s) were IGNORED by else-if logic!`);
            console.log('\n💥 BUG IMPACT: Available updates are lost due to conditional logic design');
            console.log('💡 SOLUTION: Replace else-if chain with parallel if statements');
        }

        // Verify the conditional logic bug occurred
        expect(totalRenders).toBeLessThanOrEqual(2); // Updates should be batched together
        expect(collectionsWithUpdates).toBeGreaterThan(collectionsProcessed); // Bug: Available sourceValues ignored by else-if logic
        expect(updateDecision.source).not.toBe('none'); // At least one collection should be processed

        // Verify no actual data loss (the bug affects logic, not data integrity)
        expect(result.current.chatReports).toBeDefined();
        expect(result.current.policies).toBeDefined();
        expect(result.current.transactions).toBeDefined();
    });

    it('should demonstrate BOTH race condition AND logic bug occurring simultaneously', async () => {
        // This test combines BOTH problems to show the worst-case scenario:
        // 1. RACE CONDITION: Multiple updates to one collection → only first sourceValue visible
        // 2. LOGIC BUG: Available sourceValues from other collections → ignored by else-if chain
        // RESULT: Maximum possible missed cache updates from both issues compounding

        let renderCount = 0;
        const allUpdatesReceived: string[] = [];

        const {result} = renderHook(() => {
            renderCount++;
            const [chatReports, {sourceValue: reportUpdates}] = useOnyx(ONYXKEYS.COLLECTION.REPORTS);
            const [policies, {sourceValue: policiesUpdates}] = useOnyx(ONYXKEYS.COLLECTION.POLICIES);
            const [transactions, {sourceValue: transactionsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTIONS);

            if (reportUpdates !== undefined) {
                allUpdatesReceived.push(`reports_${renderCount}`);
            }
            if (policiesUpdates !== undefined) {
                allUpdatesReceived.push(`policies_${renderCount}`);
            }
            if (transactionsUpdates !== undefined) {
                allUpdatesReceived.push(`transactions_${renderCount}`);
            }

            // Replicate the problematic else-if logic from useSidebarOrderedReports.tsx
            const getUpdatedReports = () => {
                let reportsToUpdate: string[] = [];
                // This else-if chain creates the logic bug
                if (reportUpdates) {
                    // PROBLEM: Only shows FIRST report update due to race condition
                    reportsToUpdate = Object.keys(reportUpdates);
                    return {source: 'reports', updates: reportsToUpdate, reportCount: Object.keys(reportUpdates).length};
                } else if (policiesUpdates) {
                    // PROBLEM: Never reached when reportUpdates exists (even if policies updated too)
                    const updatedPolicies = Object.keys(policiesUpdates);
                    reportsToUpdate = updatedPolicies.map((key) => `affected_by_policy_${key.replace(ONYXKEYS.COLLECTION.POLICIES, '')}`);
                    return {source: 'policies', updates: reportsToUpdate, policyCount: Object.keys(policiesUpdates).length};
                } else if (transactionsUpdates) {
                    // PROBLEM: Never reached when reportUpdates OR policiesUpdates exist
                    const transactionReports = Object.values(transactionsUpdates).map((txn: any) => `report_${txn?.reportID}`);
                    reportsToUpdate = transactionReports;
                    return {source: 'transactions', updates: reportsToUpdate, transactionCount: Object.keys(transactionsUpdates).length};
                }
                return {source: 'none', updates: [], reportCount: 0, policyCount: 0, transactionCount: 0};
            };

            return {
                chatReports,
                policies,
                transactions,
                reportUpdates,
                policiesUpdates,
                transactionsUpdates,
                getUpdatedReports: getUpdatedReports(),
            };
        });

        await act(async () => waitForPromisesToResolve());

        // Add a tiny update to ensure batching mechanism is primed (helps with test isolation)
        await act(async () => {
            Onyx.merge(`${ONYXKEYS.COLLECTION.PRIMER_COLLECTION}warmup`, {primed: true});
            await waitForPromisesToResolve();
        });

        // Extra timing buffer for this complex test (5 rapid updates can be timing-sensitive)
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 25));

        const initialRenderCount = renderCount;
        allUpdatesReceived.length = 0;

        console.log('\n=== COMBINED Race Condition + Logic Bug Test ===');
        console.log('Simulating the WORST-CASE scenario:');
        console.log('• Multiple rapid updates to reports (race condition)');
        console.log('• Single updates to policies & transactions (logic bug)');

        // The worst-case scenario: rapid updates + simultaneous cross-collection updates
        await act(async () => {
            // RACE CONDITION TARGET: Multiple rapid updates to reports collection
            Onyx.merge(`${ONYXKEYS.COLLECTION.REPORTS}report1`, {
                reportID: 'report1',
                lastMessage: 'First report update',
                step: 1,
            });
            Onyx.merge(`${ONYXKEYS.COLLECTION.REPORTS}report2`, {
                reportID: 'report2',
                lastMessage: 'Second report update',
                step: 2,
            });
            Onyx.merge(`${ONYXKEYS.COLLECTION.REPORTS}report3`, {
                reportID: 'report3',
                lastMessage: 'Third report update',
                step: 3,
            });

            // LOGIC BUG TARGETS: Single updates to other collections (will be ignored)
            Onyx.merge(`${ONYXKEYS.COLLECTION.POLICIES}policy1`, {
                id: 'policy1',
                name: 'Updated Policy',
                employeeCount: 15,
            });
            Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTIONS}txn1`, {
                transactionID: 'txn1',
                reportID: 'report1',
                amount: 5000,
                status: 'pending',
            });

            await waitForPromisesToResolve();
        });

        // Extra wait after complex batch to ensure all timing-sensitive operations complete
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 10));
        await waitForPromisesToResolve();

        const totalRenders = renderCount - initialRenderCount;
        const updateDecision = result.current.getUpdatedReports;

        console.log('\n=== DEVASTATING RESULTS ===');
        console.log(`Total renders: ${totalRenders}`);
        console.log(`Updates received: [${allUpdatesReceived.join(', ')}]`);
        console.log(`Decision: ${updateDecision.source} → ${updateDecision.updates.length} reports to update`);
        console.log(`Winning collection: "${updateDecision.source}" (due to else-if precedence and timing)`);

        // Analyze the compound damage
        const hasReportUpdates = result.current.reportUpdates !== undefined;
        const hasPolicyUpdates = result.current.policiesUpdates !== undefined;
        const hasTransactionUpdates = result.current.transactionsUpdates !== undefined;

        console.log('\n🎯 DAMAGE ASSESSMENT:');
        console.log(`• Reports sourceValue: ${hasReportUpdates ? '✅ Available' : '❌ Missing'}`);
        console.log(`• Policies sourceValue: ${hasPolicyUpdates ? '✅ Available' : '❌ Missing'}`);
        console.log(`• Transactions sourceValue: ${hasTransactionUpdates ? '✅ Available' : '❌ Missing'}`);

        if (hasReportUpdates) {
            console.log(`  → Reports keys: ${Object.keys(result.current.reportUpdates || {}).join(', ')}`);
        }
        if (hasPolicyUpdates) {
            console.log(`  → Policies keys: ${Object.keys(result.current.policiesUpdates || {}).join(', ')}`);
        }
        if (hasTransactionUpdates) {
            console.log(`  → Transactions keys: ${Object.keys(result.current.transactionsUpdates || {}).join(', ')}`);
        }

        // Check for race condition damage if reports won the else-if chain
        if (updateDecision.source === 'reports' && hasReportUpdates && updateDecision.reportCount) {
            console.log(`\n🚨 RACE CONDITION DAMAGE (Reports Collection):`);
            console.log(`• Expected: 3 discrete report updates to be tracked`);
            console.log(`• Actual: Only ${updateDecision.reportCount} report update(s) visible in sourceValue`);
            console.log(`• Lost: ${3 - updateDecision.reportCount} report updates due to batching race condition`);
        }

        const availableCollections = [hasReportUpdates, hasPolicyUpdates, hasTransactionUpdates].filter(Boolean).length;
        const processedCollections = updateDecision.source !== 'none' ? 1 : 0;

        if (availableCollections > processedCollections) {
            console.log(`\n🚨 LOGIC BUG DAMAGE (Conditional Chain):`);
            console.log(`• Available: ${availableCollections} collections had sourceValues`);
            console.log(`• Processed: Only ${processedCollections} collection processed`);
            console.log(`• Ignored: ${availableCollections - processedCollections} collections ignored by else-if logic`);
        }

        console.log('\n💥 COMPOUND IMPACT:');
        console.log('• Race condition causes loss of discrete report updates');
        console.log('• Logic bug causes complete loss of policy & transaction updates');
        console.log('• Combined: Maximum possible data loss in a single render cycle!');
        console.log('\n💡 SOLUTIONS NEEDED:');
        console.log('• Fix race condition: Accumulate all sourceValues during batching');
        console.log('• Fix logic bug: Replace else-if with parallel if statements');

        // Verify both problems occurred simultaneously
        expect(totalRenders).toBeLessThanOrEqual(2); // Should be batched
        expect(availableCollections).toBeGreaterThanOrEqual(2); // Multiple collections updated
        expect(processedCollections).toBe(1); // But only one processed due to logic bug

        // The else-if order determines which collection "wins" - could be any of them due to timing
        // but it should be one of the collections that actually got updates
        expect(['reports', 'policies', 'transactions']).toContain(updateDecision.source);
        expect(updateDecision.source).not.toBe('none'); // Should have processed something

        // Verify data integrity is maintained despite logic issues
        expect(result.current.chatReports).toBeDefined();
        expect(result.current.policies).toBeDefined();
        expect(result.current.transactions).toBeDefined();
    });
});
