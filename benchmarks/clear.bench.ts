/**
 * Benchmarks for Onyx.clear() at each data tier.
 *
 * Measures how long it takes to clear the entire store
 * (both in-memory cache and IndexedDB) at various scales.
 */

import {bench, describe, beforeAll} from 'vitest';
import Onyx from '../lib';
import {generateFullStore, DATA_TIERS} from './dataGenerators';
import {initOnyx, seedStore, ALL_TIERS, tierLabel} from './setup';

beforeAll(async () => {
    await initOnyx();
});

for (const tier of ALL_TIERS) {
    const label = tierLabel(tier);
    const cfg = DATA_TIERS[tier];

    describe(`clear (${label})`, () => {
        bench(
            `Onyx.clear() - ${cfg.reports} reports + ${cfg.transactions} txns`,
            async () => {
                await Onyx.clear();
            },
            {
                setup: async () => {
                    const store = generateFullStore(tier);
                    await seedStore(store);
                },
            },
        );
    });
}
