import AsyncStorageMock from '@react-native-community/async-storage/jest/async-storage-mock';

import OnyxInternal from '../../lib/Onyx.internal';
import {decorateWithMetrics, getMetrics, resetMetrics} from '../../lib/decorateWithMetrics';
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
        Object.keys(testInstance).forEach(name => decorateWithMetrics(testInstance, name));
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

    it('Should work for methods that return void', () => {
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
            });
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

    xit('Should collect metrics for a multiple methods, multiple call', () => {

    });
});
