import {measureFunction} from 'reassure';
import {OnyxSnapshotCache} from '../../lib/OnyxSnapshotCache';
import type {UseOnyxOptions, UseOnyxResult, UseOnyxSelector} from '../../lib/useOnyx';
import type {OnyxKey} from '../../lib';

// Define types for test data
type MockData = {
    id: number;
    name: string;
    value: number;
    field?: string;
};

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_KEY_2: 'test2_',
        REPORTS: 'reports_',
    },
};

// Mock selector functions
const simpleSelector: UseOnyxSelector<OnyxKey, number | undefined> = (data) => (data as MockData | undefined)?.value;

type ComplexSelectorResult = {id?: number; name?: string; computed: number; formatted: string};
const complexSelector: UseOnyxSelector<OnyxKey, ComplexSelectorResult> = (data) => {
    const mockData = data as MockData | undefined;
    return {
        id: mockData?.id,
        name: mockData?.name,
        computed: mockData?.value ? mockData.value * 2 : 0,
        formatted: `${mockData?.name}: ${mockData?.value}`,
    };
};

const selectorOptions: UseOnyxOptions<string, number | undefined> = {
    selector: simpleSelector,
    initWithStoredValues: true,
    allowStaleData: false,
};

const complexSelectorOptions: UseOnyxOptions<string, ComplexSelectorResult> = {
    selector: complexSelector,
    initWithStoredValues: true,
    allowStaleData: false,
};

// Mock results
const mockResult: UseOnyxResult<MockData> = [
    {id: 1, name: 'Test', value: 42},
    {status: 'loaded', sourceValue: {id: 1, name: 'Test', value: 42}},
];

const mockResults = Array.from(
    {length: 1000},
    (_, i): UseOnyxResult<MockData> => [
        {id: i, name: `Test${i}`, value: i * 10},
        {status: 'loaded', sourceValue: {id: i, name: `Test${i}`, value: i * 10}},
    ],
);

describe('OnyxSnapshotCache', () => {
    let cache: OnyxSnapshotCache;

    const resetCacheBeforeEachMeasure = () => {
        cache = new OnyxSnapshotCache();
    };

    describe('getSelectorId', () => {
        test('getting ID for new selector', async () => {
            await measureFunction(
                () => {
                    cache.getSelectorID(simpleSelector);
                },
                {
                    beforeEach: resetCacheBeforeEachMeasure,
                },
            );
        });

        test('getting ID for cached selector (1000 existing selectors)', async () => {
            await measureFunction(
                () => {
                    cache.getSelectorID(simpleSelector);
                },
                {
                    beforeEach: () => {
                        resetCacheBeforeEachMeasure();
                        // Pre-populate with 1000 selectors
                        for (let i = 0; i < 1000; i++) {
                            const selector: UseOnyxSelector<OnyxKey, string> = (data) => ((data as MockData | undefined)?.field ?? '') + i;
                            cache.getSelectorID(selector);
                        }
                    },
                },
            );
        });
    });

    describe('registerConsumer', () => {
        test('generating key for selector options', async () => {
            await measureFunction(
                () => {
                    cache.registerConsumer(selectorOptions);
                },
                {
                    beforeEach: resetCacheBeforeEachMeasure,
                },
            );
        });

        test('generating key for complex selector options', async () => {
            await measureFunction(
                () => {
                    cache.registerConsumer(complexSelectorOptions);
                },
                {
                    beforeEach: resetCacheBeforeEachMeasure,
                },
            );
        });

        test('generating 1000 cache keys with different selectors', async () => {
            await measureFunction(
                () => {
                    for (let i = 0; i < 1000; i++) {
                        const selector: UseOnyxSelector<OnyxKey, string> = (data) => ((data as MockData | undefined)?.field ?? '') + i;
                        const options: UseOnyxOptions<string, string> = {...selectorOptions, selector};
                        cache.registerConsumer(options);
                    }
                },
                {
                    beforeEach: resetCacheBeforeEachMeasure,
                },
            );
        });
    });

    describe('getCachedResult', () => {
        test('getting cached result (cache hit)', async () => {
            const cacheKey = cache.registerConsumer(selectorOptions);
            await measureFunction(
                () => {
                    cache.getCachedResult(ONYXKEYS.TEST_KEY, cacheKey);
                },
                {
                    beforeEach: () => {
                        resetCacheBeforeEachMeasure();
                        const key = cache.registerConsumer(selectorOptions);
                        cache.setCachedResult(ONYXKEYS.TEST_KEY, key, mockResult);
                    },
                },
            );
        });

        test('getting cached result with complex selector (cache hit)', async () => {
            const cacheKey = cache.registerConsumer(complexSelectorOptions);
            const complexResult: UseOnyxResult<ComplexSelectorResult> = [
                {id: 1, name: 'Test', computed: 84, formatted: 'Test: 42'},
                {status: 'loaded', sourceValue: {id: 1, name: 'Test', computed: 84, formatted: 'Test: 42'}},
            ];
            await measureFunction(
                () => {
                    cache.getCachedResult(ONYXKEYS.TEST_KEY, cacheKey);
                },
                {
                    beforeEach: () => {
                        resetCacheBeforeEachMeasure();
                        const key = cache.registerConsumer(complexSelectorOptions);
                        cache.setCachedResult(ONYXKEYS.TEST_KEY, key, complexResult);
                    },
                },
            );
        });

        test('getting cached result with 1000 keys in cache', async () => {
            const cacheKey = cache.registerConsumer(selectorOptions);
            await measureFunction(
                () => {
                    cache.getCachedResult(ONYXKEYS.TEST_KEY, cacheKey);
                },
                {
                    beforeEach: () => {
                        resetCacheBeforeEachMeasure();
                        // Pre-populate cache with 1000 entries
                        for (let i = 0; i < 1000; i++) {
                            const key = `test_key_${i}`;
                            const result = mockResults[i];
                            cache.setCachedResult(key, `cache_key_${i}`, result);
                        }
                        // Set our target entry
                        cache.setCachedResult(ONYXKEYS.TEST_KEY, cacheKey, mockResult);
                    },
                },
            );
        });
    });

    describe('setCachedResult', () => {
        test('setting cached result for new key', async () => {
            const cacheKey = cache.registerConsumer(selectorOptions);
            await measureFunction(
                () => {
                    cache.setCachedResult(ONYXKEYS.TEST_KEY, cacheKey, mockResult);
                },
                {
                    beforeEach: resetCacheBeforeEachMeasure,
                },
            );
        });

        test('setting cached result for existing key', async () => {
            const cacheKey = cache.registerConsumer(selectorOptions);
            await measureFunction(
                () => {
                    cache.setCachedResult(ONYXKEYS.TEST_KEY, cacheKey, mockResult);
                },
                {
                    beforeEach: () => {
                        resetCacheBeforeEachMeasure();
                        // Pre-create the key cache
                        cache.setCachedResult(ONYXKEYS.TEST_KEY, 'other_cache_key', mockResult);
                    },
                },
            );
        });
    });

    describe('invalidateForKey', () => {
        test('invalidating single key (cache hit)', async () => {
            await measureFunction(
                () => {
                    cache.invalidateForKey(ONYXKEYS.TEST_KEY);
                },
                {
                    beforeEach: () => {
                        resetCacheBeforeEachMeasure();
                        const cacheKey = cache.registerConsumer(selectorOptions);
                        cache.setCachedResult(ONYXKEYS.TEST_KEY, cacheKey, mockResult);
                    },
                },
            );
        });

        test('invalidating collection member key', async () => {
            const collectionMemberKey = `${ONYXKEYS.COLLECTION.REPORTS}123`;
            await measureFunction(
                () => {
                    cache.invalidateForKey(collectionMemberKey);
                },
                {
                    beforeEach: () => {
                        resetCacheBeforeEachMeasure();
                        const cacheKey = cache.registerConsumer(selectorOptions);
                        // Cache both collection and member
                        cache.setCachedResult(ONYXKEYS.COLLECTION.REPORTS, cacheKey, mockResult);
                        cache.setCachedResult(collectionMemberKey, cacheKey, mockResult);
                    },
                },
            );
        });
    });
});
