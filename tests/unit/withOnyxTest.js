import React from 'react';
import {render} from '@testing-library/react-native';
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

describe('withOnyx', () => {
    it('should update withOnyx subscribing to individual key if mergeCollection is used', () => {
        const collectionItemID = 1;
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: `${ONYX_KEYS.COLLECTION.TEST_KEY}${collectionItemID}`,
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

describe('withOnyx', () => {
    it('should update withOnyx subscribing to individual key with merged value if mergeCollection is used', () => {
        const collectionItemID = 4;
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: `${ONYX_KEYS.COLLECTION.TEST_KEY}${collectionItemID}`,
            },
        })(ViewWithCollections);
        const onRender = jest.fn();
        render(<TestComponentWithOnyx onRender={onRender} />);
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_4: {ID: 456}, test_5: {ID: 567}});
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_4: {Name: 'Test4'}, test_5: {Name: 'Test5'}, test_6: {ID: 678, Name: 'Test6'}});
        return waitForPromisesToResolve()
            .then(() => {
                expect(onRender.mock.calls.length).toBe(3);
                expect(onRender.mock.instances[2].text).toEqual({ID: 456, Name: 'Test4'});
            });
    });
});
