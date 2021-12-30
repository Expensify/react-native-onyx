import localforage from 'localforage';
import _ from 'underscore';

import StorageProvider from '../../../../lib/storage/providers/LocalForage';

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
    beforeEach(() => jest.resetAllMocks());

    it('multiSet', () => {
        // Given multiple pairs to be saved in storage
        const pairs = SAMPLE_ITEMS.slice();

        // When they are saved
        StorageProvider.multiSet(pairs);

        // We expect a call to localForage.setItem for each pair
        _.each(pairs, ([key, value]) => expect(localforage.setItem).toHaveBeenCalledWith(key, value));
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
        StorageProvider.multiMerge([
            ['@USER_1', USER_1_DELTA],
            ['@USER_2', USER_2_DELTA]
        ])
            .then(() => {
                // Then each existing item should be set with the merged content
                expect(setItemSpy).toHaveBeenCalledWith(
                    '@USER_1', {
                        name: 'Tom',
                        age: 30,
                        traits: {
                            hair: 'brown',
                            eyes: 'blue'
                        }
                    }
                );

                expect(setItemSpy).toHaveBeenCalledWith(
                    '@USER_2', {
                        name: 'Sarah',
                        age: 31,
                        traits: {
                            hair: 'green',
                        }
                    }
                );
            });
    });
});
