import _ from 'underscore';

import IDBKeyValProviderMock from '../../../../lib/storage/providers/IDBKeyVal';
import createDeferredTask from '../../../../lib/createDeferredTask';
import waitForPromisesToResolve from '../../../utils/waitForPromisesToResolve';

describe('storage/providers/IDBKeyVal', () => {
    const SAMPLE_ITEMS = [
        ['string', 'Plain String'],
        ['array', ['Mixed', {array: [{id: 1}, {id: 2}]}]],
        ['true', true],
        ['false', false],
        ['object', {id: 'Object', nested: {content: 'Nested object'}}],
        ['number', 100],
    ];

    // For some reason fake timers cause promises to hang
    beforeAll(() => jest.useRealTimers());
    beforeEach(() => {
        jest.clearAllMocks();
        IDBKeyValProviderMock.clear();
        IDBKeyValProviderMock.clear.mockClear();
    });

    it('multiSet', () => {
        // Given multiple pairs to be saved in storage
        const pairs = SAMPLE_ITEMS.slice();

        // When they are saved
        return IDBKeyValProviderMock.multiSet(pairs).then(() => {
            // We expect a call to idbKeyval.setItem for each pair
            _.each(pairs, ([key, value]) => expect(IDBKeyValProviderMock.setItem).toHaveBeenCalledWith(key, value));
        });
    });

    it('multiGet', () => {
        // Given we have some data in storage
        IDBKeyValProviderMock.multiSet(SAMPLE_ITEMS);

        return waitForPromisesToResolve().then(() => {
            // Then multi get should retrieve them
            const keys = _.map(SAMPLE_ITEMS, _.head);
            return IDBKeyValProviderMock.multiGet(keys).then((pairs) => expect(pairs).toEqual(expect.arrayContaining(SAMPLE_ITEMS)));
        });
    });

    it('multiMerge', () => {
        // Given existing data in storage
        const USER_1 = {
            name: 'Tom',
            age: 30,
            traits: {hair: 'brown'},
        };

        const USER_2 = {
            name: 'Sarah',
            age: 25,
            traits: {hair: 'black'},
        };

        IDBKeyValProviderMock.multiSet([
            ['@USER_1', USER_1],
            ['@USER_2', USER_2],
        ]);

        return waitForPromisesToResolve().then(() => {
            IDBKeyValProviderMock.idbKeyvalSet.mockClear();

            // Given deltas matching existing structure
            const USER_1_DELTA = {
                age: 31,
                traits: {eyes: 'blue'},
            };

            const USER_2_DELTA = {
                age: 26,
                traits: {hair: 'green'},
            };

            // When data is merged to storage
            return IDBKeyValProviderMock.multiMerge([
                ['@USER_1', USER_1_DELTA],
                ['@USER_2', USER_2_DELTA],
            ]).then(() => {
                // Then each existing item should be set with the merged content
                expect(IDBKeyValProviderMock.idbKeyvalSet).toHaveBeenNthCalledWith(1, '@USER_1', {
                    name: 'Tom',
                    age: 31,
                    traits: {
                        hair: 'brown',
                        eyes: 'blue',
                    },
                });

                expect(IDBKeyValProviderMock.idbKeyvalSet).toHaveBeenNthCalledWith(2, '@USER_2', {
                    name: 'Sarah',
                    age: 26,
                    traits: {
                        hair: 'green',
                    },
                });
            });
        });
    });

    it('clear', () => {
        // We're creating a Promise which we programatically control when to resolve.
        const task = createDeferredTask();

        // We configure idbKeyval.setItem to return this promise the first time it's called and to otherwise return resolved promises
        IDBKeyValProviderMock.setItem = jest
            .fn()
            .mockReturnValue(Promise.resolve()) // Default behavior
            .mockReturnValueOnce(task.promise); // First call behavior

        // Make 5 StorageProvider.setItem calls - this adds 5 items to the queue and starts executing the first idbKeyval.setItem
        for (let i = 0; i < 5; i++) {
            IDBKeyValProviderMock.setItem(`key${i}`, `value${i}`);
        }

        // At this point,`idbKeyval.setItem` should have been called once, but we control when it resolves, and we'll keep it unresolved.
        // This simulates the 1st idbKeyval.setItem taking a random time.
        // We then call StorageProvider.clear() while the first idbKeyval.setItem isn't completed yet.
        IDBKeyValProviderMock.clear();

        // Any calls that follow this would have been queued - so we don't expect more than 1 `idbKeyval.setItem` call after the
        // first one resolves.
        task.resolve();

        // waitForPromisesToResolve() makes jest wait for any promises (even promises returned as the result of a promise) to resolve.
        // If StorageProvider.clear() does not abort the queue, more idbKeyval.setItem calls would be executed because they would
        // be sitting in the setItemQueue
        return waitForPromisesToResolve().then(() => {
            expect(IDBKeyValProviderMock.idbKeyvalSet).toHaveBeenCalledTimes(0);
            expect(IDBKeyValProviderMock.clear).toHaveBeenCalledTimes(1);
        });
    });
});
