/**
 * Shared setup / teardown utilities for Onyx benchmarks.
 *
 * These helpers initialize Onyx with realistic keys, seed IndexedDB with
 * generated data, and tear everything down between benchmark iterations.
 */

import Onyx from '../lib';
import type {DataTierName, GeneratedStore} from './dataGenerators';
import {DATA_TIERS, generateFullStore, ONYXKEYS} from './dataGenerators';

/**
 * Initialize Onyx with the production-like ONYXKEYS.
 * Must be called once before benchmarks run.
 */
export async function initOnyx(): Promise<void> {
    Onyx.init({
        keys: ONYXKEYS,
        maxCachedKeysCount: 100000,
    });

    // Wait for init to settle
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
    });
}

/**
 * Seed the Onyx store (and underlying IndexedDB) with data from a generated store.
 */
export async function seedStore(store: GeneratedStore): Promise<void> {
    await Onyx.multiSet(store.data);
}

/**
 * Clear all Onyx data and the underlying IndexedDB store.
 */
export async function clearStore(): Promise<void> {
    await Onyx.clear();
}

/**
 * Generate data for a tier, seed Onyx, and return the store for later use.
 */
export async function seedTier(tier: DataTierName): Promise<GeneratedStore> {
    const store = generateFullStore(tier);
    await seedStore(store);
    return store;
}

/**
 * Convenience: generate store data without seeding.
 */
export function generateTierData(tier: DataTierName): GeneratedStore {
    return generateFullStore(tier);
}

/**
 * Get the human-readable label for a tier (used in benchmark names).
 */
export function tierLabel(tier: DataTierName): string {
    const cfg = DATA_TIERS[tier];
    return `${tier} (${cfg.reports} reports, ${cfg.transactions} txns)`;
}

/**
 * All tier names for iteration in benchmarks.
 */
export const ALL_TIERS: DataTierName[] = ['small', 'modest', 'heavy', 'extreme'];
