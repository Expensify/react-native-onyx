import _ from 'underscore';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('decorateWithMetrics', () => {
    let decorateWithMetrics;
    let getMetrics;
    let resetMetrics;

    beforeEach(() => {
        jest.resetModules();
        const metrics = require('../../lib/metrics');
        decorateWithMetrics = metrics.decorateWithMetrics;
        getMetrics = metrics.getMetrics;
        resetMetrics = metrics.resetMetrics;
    });

    it('Should collect metrics for a single method, single call', () => {
        // Given an async function that resolves with an object
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);

        // When it is decorated and executed
        mockFn = decorateWithMetrics(mockFn, 'mockFn');
        mockFn('mockedKey');

        return waitForPromisesToResolve().then(() => {
            // Then stats should contain expected data regarding the call: timings, args and result
            const metrics = getMetrics();
            expect(metrics).toEqual(
                expect.objectContaining({
                    totalTime: expect.any(Number),
                    lastCompleteCall: expect.any(Object),
                    summaries: expect.objectContaining({mockFn: expect.any(Object)}),
                }),
            );

            expect(_.keys(metrics.summaries)).toHaveLength(1);

            const firstCall = metrics.summaries.mockFn.calls[0];
            expect(firstCall.startTime).toEqual(expect.any(Number));
            expect(firstCall.detail.args).toEqual(['mockedKey']);
        });
    });

    it('Should use function.name when alias was not provided', () => {
        // Given a regular JS function
        function mockFunc() {
            return Promise.resolve();
        }

        // When decorated without passing an "alias" parameter
        // eslint-disable-next-line no-func-assign
        mockFunc = decorateWithMetrics(mockFunc);
        mockFunc();

        return waitForPromisesToResolve().then(() => {
            // Then the alias should be inferred from the function name
            const stats = getMetrics();
            const result = stats.summaries.mockFunc;
            expect(result).not.toBeUndefined();
            expect(result).toEqual(expect.objectContaining({methodName: 'mockFunc'}));
        });
    });

    it('Should collect metrics for multiple calls', () => {
        // Given an async function that resolves with an object
        let mockFn = jest.fn().mockResolvedValueOnce({mock: 'value'}).mockResolvedValueOnce({mock: 'value'}).mockResolvedValueOnce({mock: 'value'});

        // When it is decorated and executed
        mockFn = decorateWithMetrics(mockFn, 'mockFn');
        mockFn('mockedKey');
        mockFn('mockedKey3');
        mockFn('mockedKey2');

        return waitForPromisesToResolve().then(() => {
            // Then stats should have data regarding each call
            const calls = getMetrics().summaries.mockFn.calls;
            expect(calls).toHaveLength(3);
            expect(calls).toEqual([
                expect.objectContaining({
                    detail: expect.objectContaining({args: ['mockedKey']}),
                }),
                expect.objectContaining({
                    detail: expect.objectContaining({args: ['mockedKey3']}),
                }),
                expect.objectContaining({
                    detail: expect.objectContaining({args: ['mockedKey2']}),
                }),
            ]);
        });
    });

    it('Should work for methods that return Promise<void>', () => {
        // Given an async function that resolves with no data
        let mockFn = jest.fn().mockResolvedValueOnce().mockResolvedValueOnce();

        // When it is decorated and executed
        mockFn = decorateWithMetrics(mockFn, 'mockFn');
        mockFn('mockedKey', {ids: [1, 2, 3]});
        mockFn('mockedKey', {ids: [4, 5, 6]});

        return waitForPromisesToResolve().then(() => {
            // Then stats should still contain data about the calls
            const calls = getMetrics().summaries.mockFn.calls;
            expect(calls).toHaveLength(2);
            expect(calls).toEqual([
                expect.objectContaining({
                    detail: {args: ['mockedKey', {ids: [1, 2, 3]}], alias: 'mockFn'},
                }),
                expect.objectContaining({
                    detail: {args: ['mockedKey', {ids: [4, 5, 6]}], alias: 'mockFn'},
                }),
            ]);
        });
    });

    it('Should not affect the returned value from the original method', () => {
        // Given an async function that resolves with an object
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);

        // When it is decorated and executed
        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        return mockFn('mockedKey')
            .then((result) => {
                // Then the result should be the same with the result of the non decorated version
                expect(result).toEqual(mockedResult);
            })
            .then(waitForPromisesToResolve);
    });

    it('Should collect metrics for a multiple functions, single call', () => {
        // Given multiple async functions that resolves with objects
        let mockGet = jest.fn().mockResolvedValueOnce({mock: 'value'});
        let mockGetAllKeys = jest.fn().mockResolvedValueOnce(['my', 'mock', 'keys']);

        // When each is decorated and executed one time
        mockGet = decorateWithMetrics(mockGet, 'mockGet');
        mockGetAllKeys = decorateWithMetrics(mockGetAllKeys, 'mockGetAllKeys');

        mockGet('mockedKey');
        mockGetAllKeys();

        return waitForPromisesToResolve().then(() => {
            // Then stats should contain data for each function and each call under the correct function alias
            const stats = getMetrics().summaries;
            expect(_.keys(stats)).toHaveLength(2);

            expect(stats).toEqual(
                expect.objectContaining({
                    mockGet: expect.any(Object),
                    mockGetAllKeys: expect.any(Object),
                }),
            );

            expect(stats.mockGet.calls).toHaveLength(1);
            expect(stats.mockGetAllKeys.calls).toHaveLength(1);
        });
    });

    it('Should collect metrics for a multiple functions, multiple call', () => {
        // Given multiple async functions that resolves with objects
        let mockGetAllKeys = jest
            .fn()
            .mockResolvedValueOnce(['my', 'mock', 'keys'])
            .mockResolvedValueOnce(['my', 'mock', 'keys', 'and'])
            .mockResolvedValueOnce(['my', 'mock', 'keys', 'and', 'more']);

        let mockSetItem = jest.fn().mockResolvedValueOnce().mockResolvedValueOnce();

        // When they are decorated
        mockGetAllKeys = decorateWithMetrics(mockGetAllKeys, 'mockGetAllKeys');
        mockSetItem = decorateWithMetrics(mockSetItem, 'mockSetItem');

        // When each is executed multiple times
        mockGetAllKeys();
        mockSetItem('and', 'Mock value');
        mockGetAllKeys();
        mockSetItem('more', 'Mock value');
        mockGetAllKeys();

        return waitForPromisesToResolve().then(() => {
            // Then stats should contain data for each function and each call under the correct function alias
            const stats = getMetrics().summaries;
            expect(_.keys(stats)).toHaveLength(2);

            expect(stats).toEqual(
                expect.objectContaining({
                    mockGetAllKeys: expect.any(Object),
                    mockSetItem: expect.any(Object),
                }),
            );

            expect(stats.mockGetAllKeys.calls).toHaveLength(3);
            expect(stats.mockSetItem.calls).toHaveLength(2);
        });
    });

    it('Attempting to decorate already decorated method should throw', () => {
        // Given a function that is decorated
        let mockFn = jest.fn();
        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        // When you try to decorate again the same function
        expect(() => decorateWithMetrics(mockFn, 'mockFn'))
            // Then it should throw an exception
            .toThrow('"mockFn" is already decorated');
    });

    it('Adding more data after clearing should work', () => {
        // Given an async function that is decorated
        let mockFn = jest.fn().mockResolvedValueOnce().mockResolvedValueOnce().mockResolvedValueOnce();

        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        // Given some call made with the decorated function
        mockFn('mockedKey', {ids: [1, 2, 3]});
        mockFn('mockedKey', {ids: [4, 5, 6]});

        return waitForPromisesToResolve()
            .then(() => {
                // When metrics are reset
                expect(getMetrics().summaries.mockFn.calls).toHaveLength(2);
                resetMetrics();

                // Then no data regarding the calls that happened before should exist
                expect(getMetrics().summaries.mockFn).not.toBeDefined();

                // When more calls are made
                mockFn('mockedKey', {ids: [1, 2, 3]});

                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then only these calls should appear in stats
                expect(getMetrics().summaries.mockFn.calls).toHaveLength(1);
            });
    });

    it('Should work with custom alias', () => {
        // Given an async function that resolves with an object
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);

        // When it is decorated with a custom alias as a 2nd parameter
        mockFn = decorateWithMetrics(mockFn, 'mock:get');
        mockFn('mockKey');

        return waitForPromisesToResolve()
            .then(() => {
                // Then stats should contain data regarding the calls under that custom alias
                const stats = getMetrics().summaries;
                expect(stats).toEqual(
                    expect.objectContaining({
                        'mock:get': expect.any(Object),
                    }),
                );
            })
            .finally(resetMetrics);
    });

    it('Should return 0 total time and stats when no stats are collected yet', () => {
        // Given no calls made

        // When getMetrics is called
        const result = getMetrics();

        // Then stats should be empty and the total time 0
        expect(result.summaries).toEqual({});
        expect(result.totalTime).toEqual(0);
        expect(result.lastCompleteCall).not.toBeDefined();
    });

    it('Should calculate total and average correctly', () => {
        // Given an async function that resolves with an object
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValue(mockedResult);

        // Given mocked performance than returns +250ms for each consecutive call
        let i = 0;
        jest.spyOn(global.performance, 'now').mockImplementation(() => 250 * i++);

        // When it is decorated
        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        // When the decorated function is executed
        mockFn('mockedKey')
            .then(waitForPromisesToResolve)
            .then(() => {
                // Then metrics should contain correctly calculated data
                const metrics = getMetrics();

                expect(metrics).toEqual(
                    expect.objectContaining({
                        totalTime: 250,
                        averageTime: 250,
                    }),
                );
            });

        // When the decorated function is executed again
        mockFn('mockedKey')
            .then(waitForPromisesToResolve)
            .then(() => {
                // Then metrics should contain correctly calculated data
                const metrics = getMetrics();

                expect(metrics).toEqual(
                    expect.objectContaining({
                        totalTime: 500,
                        averageTime: 250,
                    }),
                );
            });

        // When the decorated function is executed again
        mockFn('mockedKey')
            .then(waitForPromisesToResolve)
            .then(() => {
                // Then metrics should contain correctly calculated data
                const metrics = getMetrics();

                expect(metrics).toEqual(
                    expect.objectContaining({
                        totalTime: 750,
                        averageTime: 250,
                    }),
                );
            });
    });
});
