/**
 * Benchmarks for Onyx.init() — cold start and cache hydration.
 *
 * These measure how long it takes Onyx to initialize and hydrate its
 * in-memory cache from IndexedDB with varying store sizes.
 */

import {bench, describe} from 'vitest';
import Onyx from '../lib';
import OnyxUtils from '../lib/OnyxUtils';
import createDeferredTask from '../lib/createDeferredTask';
import {ONYXKEYS, generateFullStore, DATA_TIERS} from './dataGenerators';
import {clearStore, ALL_TIERS, tierLabel} from './setup';

for (const tier of ALL_TIERS) {
    const label = tierLabel(tier);
    const cfg = DATA_TIERS[tier];

    describe(`init (${label})`, () => {
        bench(
            `Onyx.init() with ${cfg.reports} initialKeyStates`,
            async () => {
                const store = generateFullStore(tier);
                // Reset the deferred task so init() can resolve fresh
                Object.assign(OnyxUtils.getDeferredInitTask(), createDeferredTask());
                Onyx.init({
                    keys: ONYXKEYS,
                    initialKeyStates: store.data,
                    maxCachedKeysCount: 100000,
                    enableDevTools: false,
                });
                await OnyxUtils.getDeferredInitTask().promise;
            },
            {
                teardown: async () => {
                    await Onyx.clear();
                },
            },
        );
    });
}
