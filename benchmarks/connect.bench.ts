/**
 * Benchmarks for Onyx.connect() subscriber registration
 * and subscriber notification throughput.
 */

import {bench, describe, beforeAll, afterEach} from 'vitest';
import Onyx from '../lib';
import {ONYXKEYS, generateFullStore, DATA_TIERS} from './dataGenerators';
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

    describe(`connect (${label})`, () => {
        let store: GeneratedStore;

        bench(
            `Onyx.connect() - register ${cfg.reports} individual key subscribers`,
            async () => {
                const connections: Array<ReturnType<typeof Onyx.connect>> = [];
                for (const reportID of store.meta.reportIDs) {
                    const connection = Onyx.connect({
                        key: `${ONYXKEYS.COLLECTION.REPORT}${reportID}`,
                        callback: () => {},
                    });
                    connections.push(connection);
                }
                // Disconnect all
                for (const connection of connections) {
                    Onyx.disconnect(connection);
                }
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
            `Onyx.connect() - collection subscriber for ${cfg.reports} reports`,
            async () => {
                const connection = Onyx.connect({
                    key: ONYXKEYS.COLLECTION.REPORT,
                    callback: () => {},
                    waitForCollectionCallback: true,
                });
                // Give it a moment to fire the initial callback, then disconnect
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
                Onyx.disconnect(connection);
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
            `Notification throughput - write with ${Math.min(cfg.reports, 100)} active subscribers`,
            async () => {
                // Register subscribers
                const subscriberCount = Math.min(cfg.reports, 100);
                const connections: Array<ReturnType<typeof Onyx.connect>> = [];
                let callbackCount = 0;
                for (let i = 0; i < subscriberCount; i++) {
                    const reportID = store.meta.reportIDs[i];
                    connections.push(
                        Onyx.connect({
                            key: `${ONYXKEYS.COLLECTION.REPORT}${reportID}`,
                            callback: () => {
                                callbackCount++;
                            },
                        }),
                    );
                }

                // Wait for initial callbacks to settle
                await new Promise<void>((resolve) => setTimeout(resolve, 50));
                callbackCount = 0;

                // Now trigger updates to all subscribed keys
                const promises: Array<Promise<void>> = [];
                for (let i = 0; i < subscriberCount; i++) {
                    const reportID = store.meta.reportIDs[i];
                    promises.push(
                        Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, {
                            lastMessageText: `Notification bench ${Date.now()}`,
                        }),
                    );
                }
                await Promise.all(promises);

                // Wait for all notifications to fire
                await new Promise<void>((resolve) => setTimeout(resolve, 50));

                // Disconnect all
                for (const connection of connections) {
                    Onyx.disconnect(connection);
                }
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
