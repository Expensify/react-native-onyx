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
};

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
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
            },
        })(ViewWithCollections);
        const onRender = jest.fn();
        render(<TestComponentWithOnyx onRender={onRender} />);

        Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {ID: 123});
        Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`, {ID: 234});
        Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}3`, {ID: 345});
        return waitForPromisesToResolve()
            .then(() => {
                expect(onRender.mock.calls.length).toBe(4);
            });
    });
});

describe('withOnyx', () => {
    it('should update withOnyx subscriber just once when mergeCollection is used', () => {
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
            },
        })(ViewWithCollections);
        const onRender = jest.fn();
        render(<TestComponentWithOnyx onRender={onRender} />);

        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, test_2: {ID: 234}, test_3: {ID: 345}});
        return waitForPromisesToResolve()
            .then(() => {
                expect(onRender.mock.calls.length).toBe(2);
            });
    });
});
