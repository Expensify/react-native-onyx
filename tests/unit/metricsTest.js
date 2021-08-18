import {
    decorateWithMetrics,
    getMetrics,
    resetMetrics
} from '../../lib/metrics';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('decorateWithMetrics', () => {
    beforeEach(() => waitForPromisesToResolve()
        .then(resetMetrics));

    it('Should collect metrics for a single method, single call', () => {
        // GIVEN an async function that resolves with an object
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);

        // WHEN it is decorated and executed
        mockFn = decorateWithMetrics(mockFn, 'mockFn');
        mockFn('mockedKey');

        return waitForPromisesToResolve()
            .then(() => {
                // THEN stats should contain expected data regarding the call: timings, args and result
                const metrics = getMetrics();
                expect(metrics).toEqual(expect.objectContaining({
                    totalTime: expect.any(Number),
                    lastCompleteCall: expect.any(Object),
                    summaries: expect.objectContaining({mockFn: expect.any(Object)}),
                }));

                expect(Object.keys(metrics.summaries)).toHaveLength(1);

                const firstCall = metrics.summaries.mockFn.calls[0];
                expect(firstCall.startTime).toEqual(expect.any(Number));
                expect(firstCall.endTime).toEqual(expect.any(Number));
                expect(firstCall.args).toEqual(['mockedKey']);
            });
    });

    it('Should use function.name when alias was not provided', () => {
        // GIVEN a regular JS function
        function mockFunc() {
            return Promise.resolve();
        }

        // WHEN decorated without passing an "alias" parameter
        // eslint-disable-next-line no-func-assign
        mockFunc = decorateWithMetrics(mockFunc);
        mockFunc();

        waitForPromisesToResolve()
            .then(() => {
                // THEN the alias should be inferred from the function name
                const stats = getMetrics();
                expect(stats).toHaveLength(1);
                expect(stats).toEqual([
                    expect.objectContaining({methodName: 'mockFunc'})
                ]);
            });
    });

    it('Should collect metrics for multiple calls', () => {
        // GIVEN an async function that resolves with an object
        let mockFn = jest.fn()
            .mockResolvedValueOnce({mock: 'value'})
            .mockResolvedValueOnce({mock: 'value'})
            .mockResolvedValueOnce({mock: 'value'});

        // WHEN it is decorated and executed
        mockFn = decorateWithMetrics(mockFn, 'mockFn');
        mockFn('mockedKey');
        mockFn('mockedKey3');
        mockFn('mockedKey2');

        return waitForPromisesToResolve()
            .then(() => {
                // THEN stats should have data regarding each call
                const calls = getMetrics().summaries.mockFn.calls;
                expect(calls).toHaveLength(3);
                expect(calls).toEqual([
                    expect.objectContaining({args: ['mockedKey']}),
                    expect.objectContaining({args: ['mockedKey3']}),
                    expect.objectContaining({args: ['mockedKey2']}),
                ]);
            });
    });

    it('Should work for methods that return Promise<void>', () => {
        // GIVEN an async function that resolves with no data
        let mockFn = jest.fn()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        // WHEN it is decorated and executed
        mockFn = decorateWithMetrics(mockFn, 'mockFn');
        mockFn('mockedKey', {ids: [1, 2, 3]});
        mockFn('mockedKey', {ids: [4, 5, 6]});

        return waitForPromisesToResolve()
            .then(() => {
                // THEN stats should still contain data about the calls
                const calls = getMetrics().summaries.mockFn.calls;
                expect(calls).toHaveLength(2);
                expect(calls).toEqual([
                    expect.objectContaining({args: ['mockedKey', {ids: [1, 2, 3]}]}),
                    expect.objectContaining({args: ['mockedKey', {ids: [4, 5, 6]}]}),
                ]);
            });
    });

    it('Should not affect the returned value from the original method', () => {
        // GIVEN an async function that resolves with an object
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);

        // WHEN it is decorated and executed
        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        return mockFn('mockedKey')
            .then((result) => {
                // THEN the result should be the same with the result of the non decorated version
                expect(result).toEqual(mockedResult);
            })
            .then(waitForPromisesToResolve);
    });

    it('Should collect metrics for a multiple functions, single call', () => {
        // GIVEN multiple async functions that resolves with objects
        let mockGet = jest.fn().mockResolvedValueOnce({mock: 'value'});
        let mockGetAllKeys = jest.fn().mockResolvedValueOnce(['my', 'mock', 'keys']);

        // WHEN each is decorated and executed one time
        mockGet = decorateWithMetrics(mockGet, 'mockGet');
        mockGetAllKeys = decorateWithMetrics(mockGetAllKeys, 'mockGetAllKeys');

        mockGet('mockedKey');
        mockGetAllKeys();

        return waitForPromisesToResolve()
            .then(() => {
                // THEN stats should contain data for each function and each call under the correct function alias
                const stats = getMetrics().summaries;
                expect(Object.keys(stats)).toHaveLength(2);

                expect(stats).toEqual(expect.objectContaining({
                    mockGet: expect.any(Object),
                    mockGetAllKeys: expect.any(Object),
                }));

                expect(stats.mockGet.calls).toHaveLength(1);
                expect(stats.mockGetAllKeys.calls).toHaveLength(1);
            });
    });

    it('Should collect metrics for a multiple functions, multiple call', () => {
        // GIVEN multiple async functions that resolves with objects
        let mockGetAllKeys = jest.fn()
            .mockResolvedValueOnce(['my', 'mock', 'keys'])
            .mockResolvedValueOnce(['my', 'mock', 'keys', 'and'])
            .mockResolvedValueOnce(['my', 'mock', 'keys', 'and', 'more']);

        let mockSetItem = jest.fn()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        // WHEN they are decorated
        mockGetAllKeys = decorateWithMetrics(mockGetAllKeys, 'mockGetAllKeys');
        mockSetItem = decorateWithMetrics(mockSetItem, 'mockSetItem');

        // WHEN each is executed multiple times
        mockGetAllKeys();
        mockSetItem('and', 'Mock value');
        mockGetAllKeys();
        mockSetItem('more', 'Mock value');
        mockGetAllKeys();

        return waitForPromisesToResolve()
            .then(() => {
                // THEN stats should contain data for each function and each call under the correct function alias
                const stats = getMetrics().summaries;
                expect(Object.keys(stats)).toHaveLength(2);

                expect(stats).toEqual(expect.objectContaining({
                    mockGetAllKeys: expect.any(Object),
                    mockSetItem: expect.any(Object),
                }));

                expect(stats.mockGetAllKeys.calls).toHaveLength(3);
                expect(stats.mockSetItem.calls).toHaveLength(2);
            });
    });

    it('Attempting to decorate already decorated method should throw', () => {
        // GIVEN a function that is decorated
        let mockFn = jest.fn();
        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        // WHEN you try to decorate again the same function
        expect(() => decorateWithMetrics(mockFn, 'mockFn'))

            // THEN it should throw an exception
            .toThrow('"mockFn" is already decorated');
    });

    it('Adding more data after clearing should work', () => {
        // GIVEN an async function that is decorated
        let mockFn = jest.fn()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        // GIVEN some call made with the decorated function
        mockFn('mockedKey', {ids: [1, 2, 3]});
        mockFn('mockedKey', {ids: [4, 5, 6]});

        return waitForPromisesToResolve()
            .then(() => {
                // WHEN metrics are reset
                expect(getMetrics().summaries.mockFn.calls).toHaveLength(2);
                resetMetrics();

                // THEN no data regarding the calls that happened before should exist
                expect(getMetrics().summaries.mockFn).not.toBeDefined();

                // WHEN more calls are made
                mockFn('mockedKey', {ids: [1, 2, 3]});

                return waitForPromisesToResolve();
            })
            .then(() => {
                // THEN only these calls should appear in stats
                expect(getMetrics().summaries.mockFn.calls).toHaveLength(1);
            });
    });

    it('Should work with custom alias', () => {
        // GIVEN an async function that resolves with an object
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);

        // WHEN it is decorated with a custom alias as a 2nd parameter
        mockFn = decorateWithMetrics(mockFn, 'mock:get');
        mockFn('mockKey');

        return waitForPromisesToResolve()
            .then(() => {
                // THEN stats should contain data regarding the calls under that custom alias
                const stats = getMetrics().summaries;
                expect(stats).toEqual(expect.objectContaining({
                    'mock:get': expect.any(Object),
                }));
            })
            .finally(resetMetrics);
    });

    it('Should return 0 total time and stats when no stats are collected yet', () => {
        // GIVEN no calls made

        // WHEN getMetrics is called
        const result = getMetrics();

        // THEN stats should be empty and the total time 0
        expect(result.summaries).toEqual({});
        expect(result.totalTime).toEqual(0);
        expect(result.lastCompleteCall).not.toBeDefined();
    });

    it('Should calculate total and average correctly', () => {
        // GIVEN an async function that resolves with an object
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValue(mockedResult);

        // GIVEN mocked performance than returns +250ms for each consecutive call
        let i = 0;
        jest.spyOn(global.performance, 'now')
            .mockImplementation(() => 250 * i++);

        // WHEN it is decorated
        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        // WHEN the decorated function is executed
        mockFn('mockedKey')
            .then(waitForPromisesToResolve)
            .then(() => {
                // THEN metrics should contain correctly calculated data
                const metrics = getMetrics();

                expect(metrics).toEqual(expect.objectContaining({
                    totalTime: 250,
                    averageTime: 250,
                }));
            });

        // WHEN the decorated function is executed again
        mockFn('mockedKey')
            .then(waitForPromisesToResolve)
            .then(() => {
                // THEN metrics should contain correctly calculated data
                const metrics = getMetrics();

                expect(metrics).toEqual(expect.objectContaining({
                    totalTime: 500,
                    averageTime: 250,
                }));
            });

        // WHEN the decorated function is executed again
        mockFn('mockedKey')
            .then(waitForPromisesToResolve)
            .then(() => {
                // THEN metrics should contain correctly calculated data
                const metrics = getMetrics();

                expect(metrics).toEqual(expect.objectContaining({
                    totalTime: 750,
                    averageTime: 250,
                }));
            });
    });
});
