describe('decorateWithMetrics', () => {
    let decorateWithMetrics;

    beforeEach(() => {
        jest.resetModules();
        // eslint-disable-next-line import/extensions
        const metrics = require('../../lib/metrics/index.ts');
        decorateWithMetrics = metrics.decorateWithMetrics;
    });

    it('Should return original function', () => {
        const mockFn = jest.fn();

        const decoratedFn = decorateWithMetrics(mockFn, 'mockFn');

        expect(decoratedFn).toBeTruthy();
        expect(decoratedFn).toStrictEqual(mockFn);
    });
});
