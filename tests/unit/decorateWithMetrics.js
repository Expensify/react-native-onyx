import AsyncStorageMock from '@react-native-community/async-storage/jest/async-storage-mock';

import OnyxInternal from '../../lib/Onyx.internal';
import {decorateWithMetrics, getMetrics, restetMetrics} from '../../lib/decorateWithMetrics';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

describe('decorateWithMetrics', () => {
    let testInstance;

    beforeEach(() => {
        // In tests we're not decorating OnyxInternals directly as this will keep it decorated after the test
        testInstance = {
            get: OnyxInternal.get,
        };

        restetMetrics();
    });

    it('Should collect metrics for a single method, single call', () => {
        const mockedResult = {mockedKey: 'mockedValue'};

        AsyncStorageMock.getItem.mockResolvedValueOnce(
            JSON.stringify(mockedResult)
        );

        decorateWithMetrics(testInstance, 'get');

        const promise = testInstance.get('mockedKey')
            .then(waitForPromisesToResolve)
            .then(() => {
                const stats = getMetrics('get');
                expect(stats).toHaveLength(1);

                const firstCall = stats[0];
                expect(firstCall.result).toEqual(mockedResult);
                expect(firstCall.startTime).toEqual(expect.any(Number));
                expect(firstCall.endTime).toEqual(expect.any(Number));
                expect(firstCall.args).toEqual(['mockedKey']);
            });

        waitForPromisesToResolve();

        return promise;
    });

    it('Should collect metrics for a single method, multiple calls', () => {
        AsyncStorageMock.getItem.mockResolvedValueOnce('{ "mock": "value" }');

        decorateWithMetrics(testInstance, 'get');

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

    xit('Should collect metrics for a multiple methods, single call', () => {

    });

    xit('Should collect metrics for a multiple methods, multiple call', () => {

    });
});
