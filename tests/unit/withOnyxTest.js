import React from 'react';
import {render} from '@testing-library/react-native';
import Onyx, {withOnyx} from '../../index';
import ViewWithText from '../components/ViewWithText';
import ViewWithCollections from '../components/ViewWithCollections';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    OTHER_TEST_KEY: 'otherTest',
    COLLECTION: {
        TEST_KEY: 'test_',
        OTHER_TEST_KEY: 'otherTest_',
    },
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
        return waitForPromisesToResolve()
            .then(() => {
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {ID: 123},
                    test_2: {ID: 234},
                    test_3: {ID: 345},
                });
                return waitForPromisesToResolve();
            })
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
        return waitForPromisesToResolve()
            .then(() => {
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {ID: 123},
                    test_2: {ID: 234},
                    test_3: {ID: 345},
                });
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(onRender.mock.calls.length).toBe(2);
            });
    });
});

describe('withOnyx', () => {
    it('should update withOnyx subscriber with prop dependent key only once when external prop changes', () => {
        let renderResult;
        const TestComponentWithOnyx = withOnyx({
            test: {
                key: ({testID}) => `${ONYX_KEYS.COLLECTION.TEST_KEY}${testID}`,
            },
            otherTest: {
                key: ({testID}) => `${ONYX_KEYS.COLLECTION.OTHER_TEST_KEY}${testID}`,
            },
        })(ViewWithCollections);
        const onRender = jest.fn();

        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 1}, test_2: {ID: 2}, test_3: {ID: 3}});
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.OTHER_TEST_KEY, {
            otherTest_1: {ID: 1},
            otherTest_2: {ID: 2},
            otherTest_3: {ID: 3},
        });

        return waitForPromisesToResolve()
            .then(() => {
                renderResult = render(<TestComponentWithOnyx onRender={onRender} testID="1" />);
                return waitForPromisesToResolve();
            })
            .then(() => {
                renderResult.rerender(<TestComponentWithOnyx onRender={onRender} testID="2" />);
                return waitForPromisesToResolve();
            })
            .then(() => {
                // We are calling onRender with the props inside the ViewWithCollections so we can validate them now
                expect(onRender.mock.calls[0][0].testID).toBe('1');
                expect(onRender.mock.calls[0][0].test).toEqual({ID: 1});
                expect(onRender.mock.calls[1][0].testID).toBe('2');
                expect(onRender.mock.calls[1][0].test).toEqual({ID: 2});
                expect(onRender.mock.calls.length).toBe(2);
            });
    });
});
