import localforage from 'localforage';
import _ from 'underscore';

import StorageProvider from '../../../../lib/storage/providers/LocalForage';
import createDeferredTask from '../../../../lib/createDeferredTask';
import waitForPromisesToResolve from '../../../utils/waitForPromisesToResolve';

describe('storage/providers/LocalForage', () => {
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
        jest.resetAllMocks();
        localforage.setItem = jest.fn(() => Promise.resolve());
    });

    it('multiSet', () => {
        // Given multiple pairs to be saved in storage
        const pairs = SAMPLE_ITEMS.slice();

        // When they are saved
        return StorageProvider.multiSet(pairs)
            .then(() => {
                // We expect a call to localForage.setItem for each pair
                _.each(pairs, ([key, value]) => expect(localforage.setItem).toHaveBeenCalledWith(key, value));
            });
    });

    it('multiGet', () => {
        // Given we have some data in storage
        localforage.getItem.mockImplementation((key) => {
            const pair = _.find(SAMPLE_ITEMS, ([itemKey]) => itemKey === key);
            return Promise.resolve(_.last(pair));
        });

        // Then multi get should retrieve them
        const keys = _.map(SAMPLE_ITEMS, _.head);
        return StorageProvider.multiGet(keys)
            .then(pairs => expect(pairs).toEqual(expect.arrayContaining(SAMPLE_ITEMS)));
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

        localforage.getItem
            .mockResolvedValueOnce(USER_1)
            .mockResolvedValueOnce(USER_2);

        // Given deltas matching existing structure
        const USER_1_DELTA = {
            age: 31,
            traits: {eyes: 'blue'},
        };

        const USER_2_DELTA = {
            age: 26,
            traits: {hair: 'green'},
        };

        // Given a spy on the setItem calls we're expected to make
        const setItemSpy = localforage.setItem.mockImplementation(() => Promise.resolve());

        // When data is merged to storage
        return StorageProvider.multiMerge([
            ['@USER_1', USER_1_DELTA],
            ['@USER_2', USER_2_DELTA],
        ])
            .then(() => {
                // Then each existing item should be set with the merged content
                expect(setItemSpy).toHaveBeenNthCalledWith(1,
                    '@USER_1', {
                        name: 'Tom',
                        age: 31,
                        traits: {
                            hair: 'brown',
                            eyes: 'blue',
                        },
                    });

                expect(setItemSpy).toHaveBeenNthCalledWith(2,
                    '@USER_2', {
                        name: 'Sarah',
                        age: 26,
                        traits: {
                            hair: 'green',
                        },
                    });
            });
    });

    it('clear', () => {
        // We're creating a Promise which we programatically control when to resolve.
        const task = createDeferredTask();

        // We configure localforage.setItem to return this promise the first time it's called and to otherwise return resolved promises
        localforage.setItem = jest.fn()
            . mockReturnValue(Promise.resolve()) // Default behavior
            . mockReturnValueOnce(task.promise); // First call behavior

        // Make 5 StorageProvider.setItem calls - this adds 5 items to the queue and starts executing the first localForage.setItem
        for (let i = 0; i < 5; i++) {
            StorageProvider.setItem(`key${i}`, `value${i}`);
        }

        // At this point,`localForage.setItem` should have been called once, but we control when it resolves, and we'll keep it unresolved.
        // This simulates the 1st localForage.setItem taking a random time.
        // We then call StorageProvider.clear() while the first localForage.setItem isn't completed yet.
        StorageProvider.clear();

        // Any calls that follow this would have been queued - so we don't expect more than 1 `localForage.setItem` call after the
        // first one resolves.
        task.resolve();

        // waitForPromisesToResolve() makes jest wait for any promises (even promises returned as the result of a promise) to resolve.
        // If StorageProvider.clear() does not abort the queue, more localForage.setItem calls would be executed because they would
        // be sitting in the setItemQueue
        return waitForPromisesToResolve().then(() => {
            expect(localforage.setItem).toHaveBeenCalledTimes(1);
        });
    });
});
