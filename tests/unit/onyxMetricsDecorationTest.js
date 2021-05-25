import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('Onyx', () => {
    describe('Metrics Capturing Decoration', () => {
        const ONYX_KEYS = {
            TEST_KEY: 'test',
            ANOTHER_TEST: 'anotherTest',
        };

        // makes require calls to always return a "fresh" (undecorated) instance
        beforeEach(() => jest.resetModules());

        it('Should expose metrics methods when `captureMetrics` is true', () => {
            // Get a fresh Onyx instance
            const Onyx = require('../../index').default;

            // WHEN Onyx is initialized with `captureMetrics: true`
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
                captureMetrics: true,
            });

            // THEN Onyx should have statistic related methods
            expect(Onyx.getMetrics).toEqual(expect.any(Function));
            expect(Onyx.printMetrics).toEqual(expect.any(Function));
            expect(Onyx.resetMetrics).toEqual(expect.any(Function));
        });

        it('Should not expose metrics methods when `captureMetrics` is false or not set', () => {
            // Get a fresh Onyx instance
            const IsolatedOnyx = require('../../index').default;

            // WHEN Onyx is initialized without setting `captureMetrics`
            IsolatedOnyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
            });

            // THEN Onyx should not have statistic related methods
            expect(IsolatedOnyx.getMetrics).not.toBeDefined();
            expect(IsolatedOnyx.printMetrics).not.toBeDefined();
            expect(IsolatedOnyx.resetMetrics).not.toBeDefined();

            // WHEN Onyx is initialized with `captureMetrics: false`
            IsolatedOnyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
                captureMetrics: false,
            });

            // THEN Onyx should not have statistic related methods
            expect(IsolatedOnyx.getMetrics).not.toBeDefined();
            expect(IsolatedOnyx.printMetrics).not.toBeDefined();
            expect(IsolatedOnyx.resetMetrics).not.toBeDefined();
        });

        it('Should decorate exposed methods', () => {
            // Get a fresh Onyx instance
            const IsolatedOnyx = require('../../index').default;

            // GIVEN Onyx is initialized with `captureMetrics: true`
            IsolatedOnyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
                captureMetrics: true,
            });

            // WHEN calling decorated methods through Onyx[methodName]
            const methods = ['set', 'multiSet', 'clear', 'merge', 'mergeCollection'];
            methods.forEach(name => IsolatedOnyx[name]('mockKey', {mockKey: {mockValue: 'mockValue'}}));

            return waitForPromisesToResolve()
                .then(() => {
                // THEN metrics should have captured data for each method
                    const summaries = IsolatedOnyx.getMetrics().summaries;

                    methods.forEach((name) => {
                        expect(summaries[`Onyx:${name}`].total).toBeGreaterThan(0);
                    });
                });
        });
    });
});
