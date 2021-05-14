import {
    decorateWithMetrics,
    getMetrics,
    resetMetrics
} from '../../lib/decorateWithMetrics';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('decorateWithMetrics', () => {
    beforeEach(() => {
        resetMetrics();
    });

    it('Should collect metrics for a single method, single call', () => {
        const mockedResult = {mockedKey: 'mockedValue'};

        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);

        mockFn = decorateWithMetrics(mockFn, 'mockFn', 'mockFn');
        mockFn('mockedKey');

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics('mockFn');
                expect(stats).toHaveLength(1);

                const firstCall = stats[0];
                expect(firstCall.result).toEqual(mockedResult);
                expect(firstCall.startTime).toEqual(expect.any(Number));
                expect(firstCall.endTime).toEqual(expect.any(Number));
                expect(firstCall.args).toEqual(['mockedKey']);
            });
    });

    it('Should use function.name when alias was not provided', () => {
        function mockFunc() {}

        // eslint-disable-next-line no-func-assign
        mockFunc = decorateWithMetrics(mockFunc);
        mockFunc();

        waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics('mockFn');
                expect(stats).toHaveLength(1);
                expect(stats).toEqual([
                    expect.objectContaining({methodName: 'mockFunc'})
                ]);
            });
    });

    it('Should collect metrics for multiple calls', () => {
        let mockFn = jest.fn()
            .mockResolvedValueOnce('{ "mock": "value" }')
            .mockResolvedValueOnce('{ "mock": "value" }')
            .mockResolvedValueOnce('{ "mock": "value" }');

        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        mockFn('mockedKey');
        mockFn('mockedKey3');
        mockFn('mockedKey2');

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics('mockFn');
                expect(stats).toHaveLength(3);
                expect(stats).toEqual([
                    expect.objectContaining({args: ['mockedKey']}),
                    expect.objectContaining({args: ['mockedKey3']}),
                    expect.objectContaining({args: ['mockedKey2']}),
                ]);
            });
    });

    it('Should work for methods that return Promise<void>', () => {
        let mockFn = jest.fn()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        mockFn('mockedKey', {ids: [1, 2, 3]});
        mockFn('mockedKey', {ids: [4, 5, 6]});

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics('mockFn');
                expect(stats).toHaveLength(2);
                expect(stats).toEqual([
                    expect.objectContaining({args: ['mockedKey', {ids: [1, 2, 3]}]}),
                    expect.objectContaining({args: ['mockedKey', {ids: [4, 5, 6]}]}),
                ]);

                expect(stats).toEqual([
                    expect.objectContaining({result: undefined}),
                    expect.objectContaining({result: undefined}),
                ]);
            });
    });

    it('Should not affect the returned value from the original method', () => {
        const mockedResult = {mockedKey: 'mockedValue'};
        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);

        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        return mockFn('mockedKey')
            .then((result) => {
                expect(result).toEqual(mockedResult);
            })
            .then(waitForPromisesToResolve);
    });

    it('Should collect metrics for a multiple functions, single call', () => {
        let mockGet = jest.fn().mockResolvedValueOnce({mock: 'value'});
        let mockGetAllKeys = jest.fn().mockResolvedValueOnce(['my', 'mock', 'keys']);

        mockGet = decorateWithMetrics(mockGet, 'mockGet');
        mockGetAllKeys = decorateWithMetrics(mockGetAllKeys, 'mockGetAllKeys');

        mockGet('mockedKey');
        mockGetAllKeys();

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics();
                expect(stats).toHaveLength(2);
                expect(stats).toEqual([
                    expect.objectContaining({methodName: 'mockGet', args: ['mockedKey'], result: {mock: 'value'}}),
                    expect.objectContaining({methodName: 'mockGetAllKeys', args: [], result: ['my', 'mock', 'keys']}),
                ]);
            });
    });

    it('Should collect metrics for a multiple functions, multiple call', () => {
        let mockGetAllKeys = jest.fn()
            .mockResolvedValueOnce(['my', 'mock', 'keys'])
            .mockResolvedValueOnce(['my', 'mock', 'keys', 'and'])
            .mockResolvedValueOnce(['my', 'mock', 'keys', 'and', 'more']);

        let mockSetItem = jest.fn()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        mockGetAllKeys = decorateWithMetrics(mockGetAllKeys, 'mockGetAllKeys');
        mockSetItem = decorateWithMetrics(mockSetItem, 'mockSetItem');

        mockGetAllKeys();
        mockSetItem('and', 'Mock value');
        mockGetAllKeys();
        mockSetItem('more', 'Mock value');
        mockGetAllKeys();

        return waitForPromisesToResolve()
            .then(() => {
                const allStats = getMetrics();
                expect(allStats).toHaveLength(5);

                const allKeysCalls = getMetrics('mockGetAllKeys');
                expect(allKeysCalls).toHaveLength(3);

                const setCalls = getMetrics('mockSetItem');
                expect(setCalls).toHaveLength(2);
            });
    });

    it('Attempting to decorate already decorated method should throw', () => {
        let mockFn = jest.fn();
        mockFn = decorateWithMetrics(mockFn, 'mockFn');
        expect(() => decorateWithMetrics(mockFn, 'mockFn')).toThrow('"mockFn" is already decorated');
    });

    it('Adding more data after clearing should work', () => {
        let mockFn = jest.fn()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        mockFn('mockedKey', {ids: [1, 2, 3]});
        mockFn('mockedKey', {ids: [4, 5, 6]});

        resetMetrics();

        return waitForPromisesToResolve()
            .then(() => {
                expect(getMetrics('mockFn')).toHaveLength(2);
                resetMetrics();

                expect(getMetrics('mockFn')).toHaveLength(0);
                mockFn('mockedKey', {ids: [1, 2, 3]});

                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(getMetrics('mockFn')).toHaveLength(1);
            });
    });

    it('Should work with non promise returning methods', () => {
        let mockFn = name => `Hello ${name}`;

        mockFn = decorateWithMetrics(mockFn, 'mockFn');

        const originalResult = mockFn('Mock');
        expect(originalResult).toEqual('Hello Mock');

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics();
                expect(stats).toEqual([
                    expect.objectContaining({args: ['Mock']}),
                ]);
            })
            .finally(resetMetrics);
    });

    it('Should work with custom alias', () => {
        const mockedResult = {mockedKey: 'mockedValue'};

        let mockFn = jest.fn().mockResolvedValueOnce(mockedResult);
        mockFn = decorateWithMetrics(mockFn, 'mock:get');
        mockFn('mockKey');

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics();
                expect(stats).toEqual([
                    expect.objectContaining({methodName: 'mock:get'}),
                ]);
            })
            .finally(resetMetrics);
    });
});
