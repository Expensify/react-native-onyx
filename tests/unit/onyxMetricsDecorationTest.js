/* eslint-disable arrow-body-style */
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('Onyx', () => {
    describe('Metrics Capturing Decoration', () => {
        let Onyx;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            TEST_KEY_A: 'testA',
            TEST_KEY_B: 'testB',
            OTHER_TEST: 'otherTest',
            COLLECTION: {
                TESTING_STUFF: 'testingStuff_',
            },
        };

        // Always use a "fresh" (and undecorated) instance
        beforeEach(() => {
            jest.resetModules();
            Onyx = require('../../lib').default;
        });

        it('Should expose metrics methods when `captureMetrics` is true', () => {
            // When Onyx is initialized with `captureMetrics: true`
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
                captureMetrics: true,
            });

            // Then Onyx should have statistic related methods
            expect(Onyx.getMetrics).toEqual(expect.any(Function));
            expect(Onyx.printMetrics).toEqual(expect.any(Function));
            expect(Onyx.resetMetrics).toEqual(expect.any(Function));
        });

        it('Should not expose metrics methods when `captureMetrics` is false or not set', () => {
            // When Onyx is initialized without setting `captureMetrics`
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
            });

            // Then Onyx should not have statistic related methods
            expect(Onyx.getMetrics).not.toBeDefined();
            expect(Onyx.printMetrics).not.toBeDefined();
            expect(Onyx.resetMetrics).not.toBeDefined();

            // When Onyx is initialized with `captureMetrics: false`
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
                captureMetrics: false,
            });

            // Then Onyx should not have statistic related methods
            expect(Onyx.getMetrics).not.toBeDefined();
            expect(Onyx.printMetrics).not.toBeDefined();
            expect(Onyx.resetMetrics).not.toBeDefined();
        });

        it('Should decorate exposed methods', () => {
            // Given Onyx is initialized with `captureMetrics: true`
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
                captureMetrics: true,
            });

            // When calling decorated methods through Onyx[methodName]
            const methods = ['set', 'multiSet', 'clear', 'merge', 'mergeCollection'];
            Onyx.set(ONYX_KEYS.TEST_KEY, '1');
            Onyx.multiSet({[ONYX_KEYS.TEST_KEY_A]: 'a', [ONYX_KEYS.TEST_KEY_B]: 'b'});
            Onyx.clear();
            Onyx.merge(ONYX_KEYS.OTHER_TEST, {one: 1});
            Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TESTING_STUFF, {testingStuff_1: {one: 1}});

            return waitForPromisesToResolve()
                .then(() => {
                    // Then metrics should have captured data for each method
                    const summaries = Onyx.getMetrics().summaries;

                    methods.forEach((name) => {
                        expect(summaries[`Onyx:${name}`].total).toBeGreaterThan(0);
                    });
                });
        });
    });
});
