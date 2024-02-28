import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('Onyx', () => {
    describe('Metrics Capturing Decoration', () => {
        let Onyx;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            OTHER_TEST: 'otherTest',
        };

        // Always use a "fresh" (and undecorated) instance
        beforeEach(() => {
            jest.resetModules();
            Onyx = require('../../lib').default;
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
    });
});
