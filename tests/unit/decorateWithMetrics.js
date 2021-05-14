import AsyncStorageMock from '@react-native-community/async-storage/jest/async-storage-mock';

import OnyxInternal from '../../lib/Onyx.internal';
import {
    decorateWithMetricsMultiple,
    decorateWithMetrics,
    getMetrics,
    resetMetrics
} from '../../lib/decorateWithMetrics';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('decorateWithMetrics', () => {
    let testInstance;

    beforeEach(() => {
        // In tests we're not decorating OnyxInternals directly as this will keep it decorated after the test
        testInstance = {
            get: OnyxInternal.get,
            getAllKeys: OnyxInternal.getAllKeys,
            set: OnyxInternal.set,
        };

        resetMetrics();
        decorateWithMetricsMultiple(testInstance, Object.keys(testInstance));
    });

    it('Should collect metrics for a single method, single call', () => {
        const mockedResult = {mockedKey: 'mockedValue'};

        AsyncStorageMock.getItem.mockResolvedValueOnce(
            JSON.stringify(mockedResult)
        );

        testInstance.get('mockedKey');

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics('get');
                expect(stats).toHaveLength(1);

                const firstCall = stats[0];
                expect(firstCall.result).toEqual(mockedResult);
                expect(firstCall.startTime).toEqual(expect.any(Number));
                expect(firstCall.endTime).toEqual(expect.any(Number));
                expect(firstCall.args).toEqual(['mockedKey']);
            });
    });

    it('Should collect metrics for a single method, multiple calls', () => {
        AsyncStorageMock.getItem
            .mockResolvedValueOnce('{ "mock": "value" }')
            .mockResolvedValueOnce('{ "mock": "value" }')
            .mockResolvedValueOnce('{ "mock": "value" }');

        testInstance.get('mockedKey');
        testInstance.get('mockedKey3');
        testInstance.get('mockedKey2');

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics('get');
                expect(stats).toHaveLength(3);
                expect(stats).toEqual([
                    expect.objectContaining({args: ['mockedKey']}),
                    expect.objectContaining({args: ['mockedKey3']}),
                    expect.objectContaining({args: ['mockedKey2']}),
                ]);
            });
    });

    it('Should work for methods that return Promise<void>', () => {
        AsyncStorageMock.setItem
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        testInstance.set('mockedKey', {ids: [1, 2, 3]});
        testInstance.set('mockedKey', {ids: [4, 5, 6]});

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics('set');
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

        AsyncStorageMock.getItem.mockResolvedValueOnce(
            JSON.stringify(mockedResult)
        );

        return testInstance.get('mockedKey')
            .then((result) => {
                expect(result).toEqual(mockedResult);
            })
            .then(waitForPromisesToResolve);
    });

    it('Should collect metrics for a multiple methods, single call', () => {
        AsyncStorageMock.getItem.mockResolvedValueOnce('{ "mock": "value" }');
        AsyncStorageMock.getAllKeys.mockResolvedValueOnce(['my', 'mock', 'keys']);

        testInstance.get('mockedKey');
        testInstance.getAllKeys();

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics();
                expect(stats).toHaveLength(2);
                expect(stats).toEqual([
                    expect.objectContaining({methodName: 'get', args: ['mockedKey'], result: {mock: 'value'}}),
                    expect.objectContaining({methodName: 'getAllKeys', args: [], result: ['my', 'mock', 'keys']}),
                ]);
            });
    });

    it('Should collect metrics for a multiple methods, multiple call', () => {
        AsyncStorageMock.getAllKeys
            .mockResolvedValueOnce(['my', 'mock', 'keys'])
            .mockResolvedValueOnce(['my', 'mock', 'keys', 'and'])
            .mockResolvedValueOnce(['my', 'mock', 'keys', 'and', 'more']);

        AsyncStorageMock.setItem
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        testInstance.getAllKeys();
        testInstance.set('and', 'Mock value');
        testInstance.getAllKeys();
        testInstance.set('more', 'Mock value');
        testInstance.getAllKeys();

        return waitForPromisesToResolve()
            .then(() => {
                const allStats = getMetrics();
                expect(allStats).toHaveLength(5);

                const allKeysCalls = getMetrics('getAllKeys');
                expect(allKeysCalls).toHaveLength(3);

                const setCalls = getMetrics('set');
                expect(setCalls).toHaveLength(2);
            });
    });

    it('Attempting to decorate already decorated method should throw', () => {
        expect(() => decorateWithMetricsMultiple(testInstance, ['get'])).toThrow('"get" is already decorated');
    });

    it('Adding more data after clearing should work', () => {
        AsyncStorageMock.setItem
            .mockResolvedValueOnce()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce();

        testInstance.set('mockedKey', {ids: [1, 2, 3]});
        testInstance.set('mockedKey', {ids: [4, 5, 6]});

        resetMetrics();

        return waitForPromisesToResolve()
            .then(() => {
                expect(getMetrics('set')).toHaveLength(2);
                resetMetrics();

                expect(getMetrics('set')).toHaveLength(0);
                testInstance.set('mockedKey', {ids: [1, 2, 3]});

                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(getMetrics('set')).toHaveLength(1);
            });
    });

    it('Should work with non promise returning methods', () => {
        const mockInstance = {
            sampleSyncMethod: name => `Hello ${name}`
        };

        decorateWithMetrics(mockInstance, mockInstance.sampleSyncMethod.name);

        const originalResult = mockInstance.sampleSyncMethod('Mock');
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
        const mockInstance = {
            get: OnyxInternal.get,
            set: OnyxInternal.set,
        };

        decorateWithMetricsMultiple(mockInstance, ['get', 'set'], 'mock:');

        mockInstance.get('mockKey');
        mockInstance.set('mockKey', {});

        return waitForPromisesToResolve()
            .then(() => {
                const stats = getMetrics();
                expect(stats).toEqual([
                    expect.objectContaining({methodName: 'mock:get'}),
                    expect.objectContaining({methodName: 'mock:set'}),
                ]);
            })
            .finally(resetMetrics);
    });
});
