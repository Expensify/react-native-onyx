import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('Onyx', () => {
    describe('Metrics Capturing Decoration', () => {
        let Onyx;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            ANOTHER_TEST: 'anotherTest',
        };

        // Always use a "fresh" (and undecorated) instance
        beforeEach(() => {
            jest.resetModules();
            Onyx = require('../../index').default;
        });

        it('Should expose metrics methods when `captureMetrics` is true', () => {
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
            // WHEN Onyx is initialized without setting `captureMetrics`
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
            });

            // THEN Onyx should not have statistic related methods
            expect(Onyx.getMetrics).not.toBeDefined();
            expect(Onyx.printMetrics).not.toBeDefined();
            expect(Onyx.resetMetrics).not.toBeDefined();

            // WHEN Onyx is initialized with `captureMetrics: false`
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
                captureMetrics: false,
            });

            // THEN Onyx should not have statistic related methods
            expect(Onyx.getMetrics).not.toBeDefined();
            expect(Onyx.printMetrics).not.toBeDefined();
            expect(Onyx.resetMetrics).not.toBeDefined();
        });

        it('Should decorate exposed methods', () => {
            // GIVEN Onyx is initialized with `captureMetrics: true`
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
                captureMetrics: true,
            });

            // WHEN calling decorated methods through Onyx[methodName]
            const methods = ['set', 'multiSet', 'clear', 'merge', 'mergeCollection'];
            methods.forEach(name => Onyx[name]('mockKey', {mockKey: {mockValue: 'mockValue'}}));

            return waitForPromisesToResolve()
                .then(() => {
                // THEN metrics should have captured data for each method
                    const summaries = Onyx.getMetrics().summaries;

                    methods.forEach((name) => {
                        expect(summaries[`Onyx:${name}`].total).toBeGreaterThan(0);
                    });
                });
        });
    });
});
