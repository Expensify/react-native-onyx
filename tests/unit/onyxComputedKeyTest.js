import _ from 'underscore';
import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';

const ONYX_KEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

const TEST_COMPUTED_KEY_1 = {
    cacheKey: 'testComputed1',
    dependencies: {test: ONYX_KEYS.COLLECTION.TEST_KEY},
    compute: jest.fn(({test}) => _.values(test).sort((a, b) => b.ID - a.ID)),
};

const TEST_COMPUTED_KEY_2 = {
    cacheKey: 'testComputed2',
    dependencies: {test: TEST_COMPUTED_KEY_1},
    compute: jest.fn(({test}) => test.length),
};

Onyx.init({
    keys: ONYX_KEYS,
});

describe('Onyx computed keys', () => {
    let connectionID;

    /** @type OnyxCache */
    let cache;

    beforeEach(() => {
        cache = require('../../lib/OnyxCache').default;

        TEST_COMPUTED_KEY_1.compute.mockClear();
        TEST_COMPUTED_KEY_2.compute.mockClear();

        return Promise.all([
            StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}3`, {ID: 3}),
            StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {ID: 1}),
            StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`, {ID: 2}),
        ]);
    });

    afterEach(() => {
        StorageMock.clear();
        Onyx.disconnect(connectionID);
        return Onyx.clear();
    });

    it('connects to computed value', () =>
        new Promise((resolve) => {
            connectionID = Onyx.connect({
                key: TEST_COMPUTED_KEY_1,
                callback: (value) => {
                    expect(value).toEqual([{ID: 3}, {ID: 2}, {ID: 1}]);
                    expect(TEST_COMPUTED_KEY_1.compute).toHaveBeenCalledTimes(1);
                    expect(cache.hasCacheForKey(TEST_COMPUTED_KEY_1.cacheKey)).toBe(true);
                    resolve();
                },
            });
        }));

    it('can depend on other computed values', () =>
        new Promise((resolve) => {
            connectionID = Onyx.connect({
                key: TEST_COMPUTED_KEY_2,
                callback: (value) => {
                    expect(value).toEqual(3);
                    expect(TEST_COMPUTED_KEY_1.compute).toHaveBeenCalledTimes(1);
                    expect(cache.hasCacheForKey(TEST_COMPUTED_KEY_1.cacheKey)).toBe(true);
                    expect(TEST_COMPUTED_KEY_2.compute).toHaveBeenCalledTimes(1);
                    expect(cache.hasCacheForKey(TEST_COMPUTED_KEY_2.cacheKey)).toBe(true);
                    resolve();
                },
            });
        }));

    it('updates when dependent data changes', () => {
        const callback = jest.fn();
        connectionID = Onyx.connect({
            key: TEST_COMPUTED_KEY_1,
            callback,
        });

        return waitForPromisesToResolve()
            .then(() => {
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback.mock.calls[0][0]).toEqual([{ID: 3}, {ID: 2}, {ID: 1}]);
            })
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}4`]: {ID: 4},
                }),
            )
            .then(() => {
                expect(callback).toHaveBeenCalledTimes(2);
                expect(callback.mock.calls[1][0]).toEqual([{ID: 4}, {ID: 3}, {ID: 2}, {ID: 1}]);
            });
    });

    it('caches computed values', () => {
        const callback = jest.fn();
        connectionID = Onyx.connect({
            key: TEST_COMPUTED_KEY_1,
            callback,
        });

        return waitForPromisesToResolve()
            .then(() => {
                expect(callback).toHaveBeenCalledTimes(1);
                expect(TEST_COMPUTED_KEY_1.compute).toHaveBeenCalledTimes(1);
                Onyx.disconnect(connectionID);
                connectionID = Onyx.connect({
                    key: TEST_COMPUTED_KEY_1,
                    callback,
                });
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                expect(callback).toHaveBeenCalledTimes(2);
                expect(TEST_COMPUTED_KEY_1.compute).toHaveBeenCalledTimes(1);
            });
    });

    it('handles multiple connects at the same time', () => {
        const callback = jest.fn();
        const connections = [
            Onyx.connect({
                key: TEST_COMPUTED_KEY_1,
                callback,
            }),
            Onyx.connect({
                key: TEST_COMPUTED_KEY_1,
                callback,
            }),
            Onyx.connect({
                key: TEST_COMPUTED_KEY_2,
                callback,
            }),
        ];

        return waitForPromisesToResolve()
            .then(() => {
                expect(callback).toHaveBeenCalledTimes(3);
                expect(TEST_COMPUTED_KEY_1.compute).toHaveBeenCalledTimes(1);
                expect(TEST_COMPUTED_KEY_2.compute).toHaveBeenCalledTimes(1);
            })
            .then(() => {
                connections.forEach(Onyx.disconnect);
            });
    });

    it('disconnects dependencies', () => {
        const callback = jest.fn();
        connectionID = Onyx.connect({
            key: TEST_COMPUTED_KEY_1,
            callback,
        });

        return waitForPromisesToResolve()
            .then(() => {
                expect(callback).toHaveBeenCalledTimes(1);
                Onyx.disconnect(connectionID);
            })
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}4`]: {ID: 4},
                }),
            )
            .then(() => {
                expect(callback).toHaveBeenCalledTimes(1);
            });
    });
});
