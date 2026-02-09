/**
 * Benchmarks for Onyx.set(), Onyx.multiSet(), and Onyx.setCollection().
 *
 * Each benchmark is run for every data tier (small → extreme).
 */

import {bench, describe, beforeAll, afterEach} from 'vitest';
import Onyx from '../lib';
import {ONYXKEYS, generateFullStore, generateReport, DATA_TIERS} from './dataGenerators';
import {initOnyx, clearStore, ALL_TIERS, tierLabel} from './setup';

beforeAll(async () => {
    await initOnyx();
});

afterEach(async () => {
    await clearStore();
});

for (const tier of ALL_TIERS) {
    const label = tierLabel(tier);
    const cfg = DATA_TIERS[tier];

    describe(`set (${label})`, () => {
        bench(
            `Onyx.set() - ${cfg.reports} reports individually`,
            async () => {
                const promises: Array<Promise<void>> = [];
                for (let i = 0; i < cfg.reports; i++) {
                    const report = generateReport(i + 1, '1');
                    promises.push(Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`, report));
                }
                await Promise.all(promises);
            },
            {
                teardown: async () => {
                    await clearStore();
                },
            },
        );

        bench(
            `Onyx.multiSet() - full store (${cfg.reports} reports + ${cfg.transactions} txns)`,
            async () => {
                const store = generateFullStore(tier);
                await Onyx.multiSet(store.data);
            },
            {
                teardown: async () => {
                    await clearStore();
                },
            },
        );

        bench(
            `Onyx.setCollection() - ${cfg.reports} reports`,
            async () => {
                const collection: Record<string, unknown> = {};
                for (let i = 0; i < cfg.reports; i++) {
                    const report = generateReport(i + 1, '1');
                    collection[`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`] = report;
                }
                await Onyx.setCollection(ONYXKEYS.COLLECTION.REPORT, collection);
            },
            {
                teardown: async () => {
                    await clearStore();
                },
            },
        );
    });
}
