import _ from 'underscore';
import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

describe('The onyx cache', () => {
    let connectionID;

    beforeAll(() => {
        Onyx.init({
            keys: ONYX_KEYS,
            registerStorageEventListener: () => {},
        });
    });

    afterEach(() => {
        Onyx.disconnect(connectionID);
        return Onyx.clear();
    });


    it('grows in size without limit', () => {
        // Given a mocked function that is used as a callback to an Onyx.connect() connection
        const mockedCallback = jest.fn();

        // and a collection of 5,000 keys
        const collection = {};
        for (let i = 0; i < 5000; i++) {
            collection[`${ONYX_KEYS.COLLECTION.TEST_KEY}${i}`] = {i};
        }
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, collection);
        return waitForPromisesToResolve()

            .then(() => {
                // WHEN we connect to that collection with waitForCollectionCallback = true
                connectionID = Onyx.connect({
                    key: ONYX_KEYS.COLLECTION.TEST_KEY,
                    waitForCollectionCallback: true,
                    callback: mockedCallback,
                });
                return waitForPromisesToResolve();
            })

            // Then the mocked callback is called one time with 5,000 items in the collection
            .then(() => {
                expect(mockedCallback).toHaveBeenCalledTimes(1);
                expect(_.size(mockedCallback.mock.calls[0][0])).toBe(5000);
            })

            // When that collection is updated one of the keys changing
            .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}0`, {foo: 'bar'}))

            // Then the mocked callback is called one time with 5,000 items in the collection
            .then(() => {
                expect(mockedCallback).toHaveBeenCalledTimes(2);
                expect(_.size(mockedCallback.mock.calls[1][0])).toBe(5000);
            });
    });
});
