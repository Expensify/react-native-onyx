import 'react-native';
import {render} from '@testing-library/react-native';
import React from 'react';
import Onyx, {withOnyx} from '../../index';
import ViewWithText from '../components/ViewWithText';
import ViewWithCollections from '../components/ViewWithCollections';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
    }
}

Onyx.registerLogger(() => {});
Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
});

describe('withOnyx', () => {
    it('should render with the test data when using withOnyx', () => {
        let result;

        Onyx.set(ONYX_KEYS.TEST_KEY, 'test1')
            .then(() => {
                const TestComponentWithOnyx = withOnyx({
                    text: {
                        key: ONYX_KEYS.TEST_KEY,
                    },
                })(ViewWithText);

                result = render(<TestComponentWithOnyx />);
                return waitForPromisesToResolve();
            })
            .then(() => {
                const textComponent = result.getByText('test1');
                expect(textComponent).toBeTruthy();
            });
    });
});

describe('withOnyx', () => {
    it('should receive callback for each object change for mergeCollection', () => {
        const valuesReceived = [];
        let numberOfCallbacks = 0;
        Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                ++numberOfCallbacks;
                valuesReceived.push(value);
            },
        });

        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, test_2: {ID: 234}, test_3: {ID: 345}})
            .then(() => {
                expect(numberOfCallbacks).toEqual(3);
                expect(valuesReceived[0]).toEqual({ID: 123});
                expect(valuesReceived[1]).toEqual({ID: 234});
                expect(valuesReceived[2]).toEqual({ID: 345});
            });
    });
});

describe('withOnyx', () => {
    it('should throw error when a key not belonging to collection key is present in mergeCollection', () => {
        try {
            Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, not_my_test: {beep: 'boop'}})
        } catch (error) {
            expect(error.message).toEqual(`Provided collection does not have all its data belonging to the same parent. CollectionKey: ${ONYX_KEYS.COLLECTION.TEST_KEY}, DataKey: not_my_test`);
        }
    });
});

describe('withOnyx', () => {
    it('should update withOnyx subscriber just once when mergeCollection is used', () => {
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
            },
        })(ViewWithCollections);
        const result = render(<TestComponentWithOnyx />);

        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, test_2: {ID: 234}, test_3: {ID: 345}})
            .then(() => {
                expect(result).toHaveBeenCalledTimes(5);
            })
    });
});