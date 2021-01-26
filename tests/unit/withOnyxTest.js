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
                expect(result).toHaveBeenCalledTimes(999);
            });
    });
});

describe('withOnyx', () => {
    it('should update withOnyx subscriber multiple times when merge is used', () => {
        const logSpy = jest.spyOn(console, 'log');
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
            },
        })(ViewWithCollections);
        render(<TestComponentWithOnyx />);

        Onyx.merge(ONYX_KEYS.COLLECTION.TEST_KEY + '1', {ID: 123});
        Onyx.merge(ONYX_KEYS.COLLECTION.TEST_KEY + '2', {ID: 234});
        Onyx.merge(ONYX_KEYS.COLLECTION.TEST_KEY + '3', {ID: 345});
        return waitForPromisesToResolve()
            .then(() => {
                expect(logSpy).toHaveBeenCalledTimes(4);
                console.log.mockClear();
            });
    });
});

describe('withOnyx', () => {
    it('should update withOnyx subscriber just once when mergeCollection is used', () => {
        const logSpy = jest.spyOn(console, 'log');
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
            },
        })(ViewWithCollections);
        render(<TestComponentWithOnyx />);

        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, test_2: {ID: 234}, test_3: {ID: 345}});
        return waitForPromisesToResolve()
            .then(() => {
                expect(logSpy).toHaveBeenCalledTimes(2);
                console.log.mockClear();
            });
    });
});