/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * Test to prove that useOnyx sourceValue persists across unrelated renders,
 * making it unsound for cache invalidation logic.
 */

import {act, renderHook} from '@testing-library/react-native';
import {useState} from 'react';
import Onyx, {useOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYXKEYS = {
    COLLECTION: {
        REPORTS: 'reports_',
        POLICIES: 'policies_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(async () => {
    await Onyx.clear();
    await waitForPromisesToResolve();
});

afterEach(async () => {
    await waitForPromisesToResolve();
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 50));
    await waitForPromisesToResolve();
});

describe('Stale sourceValue Test', () => {
    it('should demonstrate that sourceValue persists across unrelated renders, making cache invalidation unsound', async () => {
        const sourceValueHistory: any[] = [];

        // Create a component that can re-render for reasons unrelated to Onyx
        const {result, rerender} = renderHook(
            ({externalState}: {externalState: number}) => {
                const [localState, setLocalState] = useState(0);
                const [reports, {sourceValue: reportsSourceValue}] = useOnyx(ONYXKEYS.COLLECTION.REPORTS);
                const [policies, {sourceValue: policiesSourceValue}] = useOnyx(ONYXKEYS.COLLECTION.POLICIES);

                // Track every sourceValue we see
                const currentSourceValues = {
                    externalState,
                    localState,
                    reportsSourceValue: reportsSourceValue ? Object.keys(reportsSourceValue) : undefined,
                    policiesSourceValue: policiesSourceValue ? Object.keys(policiesSourceValue) : undefined,
                };
                sourceValueHistory.push(currentSourceValues);

                return {
                    reports,
                    policies,
                    reportsSourceValue,
                    policiesSourceValue,
                    localState,
                    setLocalState,
                    triggerUnrelatedRerender: () => setLocalState((prev) => prev + 1),
                };
            },
            {initialProps: {externalState: 1}},
        );

        await act(async () => waitForPromisesToResolve());

        console.log('\n=== Testing sourceValue persistence across unrelated renders ===');

        // Trigger an Onyx update
        await act(async () => {
            Onyx.merge(`${ONYXKEYS.COLLECTION.REPORTS}123`, {
                reportID: '123',
                lastMessage: 'Test message',
            });
            await waitForPromisesToResolve();
        });

        const afterOnyxUpdate = sourceValueHistory[sourceValueHistory.length - 1];

        // Trigger unrelated re-renders
        rerender({externalState: 2});
        await act(async () => waitForPromisesToResolve());
        const afterPropsChange = sourceValueHistory[sourceValueHistory.length - 1];

        await act(async () => {
            result.current.triggerUnrelatedRerender();
            await waitForPromisesToResolve();
        });
        const afterStateChange = sourceValueHistory[sourceValueHistory.length - 1];

        // Check sourceValue persistence
        const hasSourceAfterOnyx = afterOnyxUpdate.reportsSourceValue !== undefined;
        const hasSourceAfterProps = afterPropsChange.reportsSourceValue !== undefined;
        const hasSourceAfterState = afterStateChange.reportsSourceValue !== undefined;

        console.log(`After Onyx update: sourceValue ${hasSourceAfterOnyx ? 'present' : 'missing'}`);
        console.log(`After props change: sourceValue ${hasSourceAfterProps ? 'PERSISTS' : 'cleared'}`);
        console.log(`After state change: sourceValue ${hasSourceAfterState ? 'PERSISTS' : 'cleared'}`);

        if (hasSourceAfterProps || hasSourceAfterState) {
            console.log('Result: sourceValue persists across unrelated renders (unsound for cache invalidation)');
        }

        // Expected behavior: sourceValue present after actual Onyx update
        expect(hasSourceAfterOnyx).toBe(true);

        // BUG: sourceValue incorrectly persists after unrelated renders
        expect(hasSourceAfterProps).toBe(true); // PROVES BUG: sourceValue should be undefined here
        expect(hasSourceAfterState).toBe(true); // PROVES BUG: sourceValue should be undefined here

        // For contrast: in a correct implementation, these should be false
        // expect(hasSourceAfterProps).toBe(false); // What SHOULD happen
        // expect(hasSourceAfterState).toBe(false); // What SHOULD happen
    });
});
