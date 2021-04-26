import React from 'react';
import {render} from '@testing-library/react-native';
import Onyx, {withOnyx} from '../../index';
import ViewWithText from '../components/ViewWithText';
import ViewWithCollections from '../components/ViewWithCollections';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import compose from '../../lib/compose';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
        RELATED_KEY: 'related_',
    },
};

Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
});

beforeEach(() => Onyx.clear());

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
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_4: {Name: 'Test4'},
            test_5: {Name: 'Test5'},
            test_6: {ID: 678, Name: 'Test6'},
        });
        return waitForPromisesToResolve()
            .then(() => {
                expect(onRender.mock.calls.length).toBe(3);
                expect(onRender.mock.instances[2].text).toEqual({ID: 456, Name: 'Test4'});
            });
    });

    it('should pass a prop from one connected component to another', () => {
        const collectionItemID = 1;
        const onRender = jest.fn();
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {id: 1}});
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.RELATED_KEY, {related_1: 'Test'});
        return waitForPromisesToResolve()
            .then(() => {
                const TestComponentWithOnyx = compose(
                    withOnyx({
                        testObject: {
                            key: `${ONYX_KEYS.COLLECTION.TEST_KEY}${collectionItemID}`,
                        },
                    }),
                    withOnyx({
                        testThing: {
                            key: ({testObject}) => `${ONYX_KEYS.COLLECTION.RELATED_KEY}${testObject.id}`,
                        },
                    }),
                )(ViewWithCollections);
                render(<TestComponentWithOnyx onRender={onRender} />);
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(onRender.mock.instances[0].testThing).toBe('Test');
            });
    });

    it('using mergeCollection to modify one item should only effect one component', () => {
        const onRender1 = jest.fn();
        const onRender2 = jest.fn();
        const onRender3 = jest.fn();

        // GIVEN there is a collection with three simple items in it
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: {ID: 1},
            test_2: {ID: 2},
            test_3: {ID: 3},
        });

        return waitForPromisesToResolve()
            .then(() => {
                // WHEN three components subscribe to each of the items in that collection
                const TestComponentWithOnyx1 = compose(
                    withOnyx({
                        testObject: {
                            key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                        },
                    }),
                )(ViewWithCollections);
                render(<TestComponentWithOnyx1 onRender={onRender1} />);

                const TestComponentWithOnyx2 = compose(
                    withOnyx({
                        testObject: {
                            key: `${ONYX_KEYS.COLLECTION.TEST_KEY}2`,
                        },
                    }),
                )(ViewWithCollections);
                render(<TestComponentWithOnyx2 onRender={onRender2} />);

                const TestComponentWithOnyx3 = compose(
                    withOnyx({
                        testObject: {
                            key: `${ONYX_KEYS.COLLECTION.TEST_KEY}3`,
                        },
                    }),
                )(ViewWithCollections);
                render(<TestComponentWithOnyx3 onRender={onRender3} />);

                return waitForPromisesToResolve();
            })
            .then(() => {
                // WHEN a single item in the collection is updated with mergeCollect()
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {ID: 1, newProperty: 'yay'},
                });
                return waitForPromisesToResolve();
            })
            .then(() => {
                // THEN the component subscribed to the modified item should have the new version of the item
                // and all other components should be unchanged.
                // Note: each component is rendered twice. Once when it is initially rendered, and then again
                // when the collection is updated. That's why there are two checks here for each component.
                expect(onRender1).toHaveBeenCalledTimes(2);
                expect(onRender1.mock.calls[0][0].testObject).toStrictEqual({ID: 1});
                expect(onRender1.mock.calls[1][0].testObject).toStrictEqual({ID: 1, newProperty: 'yay'});

                expect(onRender2).toHaveBeenCalledTimes(1);
                expect(onRender2.mock.calls[0][0].testObject).toStrictEqual({ID: 2});

                expect(onRender3).toHaveBeenCalledTimes(1);
                expect(onRender3.mock.calls[0][0].testObject).toStrictEqual({ID: 3});
            });
    });
});
