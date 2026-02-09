/**
 * Benchmarks for Onyx.merge(), Onyx.mergeCollection(), and Onyx.update().
 *
 * These benchmarks pre-seed data and then measure the cost of merging
 * partial updates into the existing store.
 */

import {bench, describe, beforeAll, afterEach} from 'vitest';
import Onyx from '../lib';
import type {OnyxKey, OnyxUpdate} from '../lib';
import {ONYXKEYS, generateFullStore, generateReport, DATA_TIERS} from './dataGenerators';
import type {GeneratedStore} from './dataGenerators';
import {initOnyx, seedStore, clearStore, ALL_TIERS, tierLabel} from './setup';

beforeAll(async () => {
    await initOnyx();
});

afterEach(async () => {
    await clearStore();
});

for (const tier of ALL_TIERS) {
    const label = tierLabel(tier);
    const cfg = DATA_TIERS[tier];

    describe(`merge (${label})`, () => {
        let store: GeneratedStore;

        bench(
            `Onyx.merge() - partial update ${cfg.reports} reports`,
            async () => {
                const promises: Array<Promise<void>> = [];
                for (const reportID of store.meta.reportIDs) {
                    promises.push(
                        Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, {
                            lastMessageText: `Updated message at ${Date.now()}`,
                            lastVisibleActionCreated: new Date().toISOString(),
                        }),
                    );
                }
                await Promise.all(promises);
            },
            {
                setup: async () => {
                    store = generateFullStore(tier);
                    await seedStore(store);
                },
                teardown: async () => {
                    await clearStore();
                },
            },
        );

        bench(
            `Onyx.mergeCollection() - partial update ${cfg.reports} reports`,
            async () => {
                const updates: Record<string, unknown> = {};
                for (const reportID of store.meta.reportIDs) {
                    updates[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`] = {
                        lastMessageText: `Bulk updated at ${Date.now()}`,
                        isPinned: true,
                    };
                }
                await Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT, updates);
            },
            {
                setup: async () => {
                    store = generateFullStore(tier);
                    await seedStore(store);
                },
                teardown: async () => {
                    await clearStore();
                },
            },
        );

        bench(
            `Onyx.update() - mixed set/merge (${cfg.reports} ops)`,
            async () => {
                const updates: Array<OnyxUpdate<OnyxKey>> = store.meta.reportIDs.map((reportID, i) => {
                    if (i % 2 === 0) {
                        return {
                            key: `${ONYXKEYS.COLLECTION.REPORT}${reportID}`,
                            onyxMethod: Onyx.METHOD.SET,
                            value: generateReport(Number(reportID), '1'),
                        };
                    }
                    return {
                        key: `${ONYXKEYS.COLLECTION.REPORT}${reportID}`,
                        onyxMethod: Onyx.METHOD.MERGE,
                        value: {lastMessageText: `Mixed update ${Date.now()}`},
                    };
                });
                await Onyx.update(updates);
            },
            {
                setup: async () => {
                    store = generateFullStore(tier);
                    await seedStore(store);
                },
                teardown: async () => {
                    await clearStore();
                },
            },
        );
    });
}
