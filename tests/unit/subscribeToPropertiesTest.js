import React from 'react';
import {render, cleanup} from '@testing-library/react-native';
import Onyx, {withOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import ViewWithObject from '../components/ViewWithObject';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
});

describe('Onyx property subscribers', () => {
    describe('Onyx.connect()', () => {
        let connectionID;

        afterEach(() => {
            Onyx.disconnect(connectionID);
            return Onyx.clear();
        });

        const runAssertionsWithMapping = (mapping, connectionCallbackMock) => waitForPromisesToResolve()

            // When that mapping is connected to Onyx
            .then(() => {
                connectionID = Onyx.connect(mapping);
                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then the callback should be called once
                expect(connectionCallbackMock).toHaveBeenCalledTimes(1);

                // With no values (since nothing is set in Onyx yet)
                expect(connectionCallbackMock).toHaveBeenCalledWith(undefined, undefined);
            })

            // When Onyx is updated to contain an object with two properties
            .then(() => Onyx.set(ONYX_KEYS.TEST_KEY, {a: 'one', b: 'two'}))

            .then(() => {
                // Then the callback should be called once more
                expect(connectionCallbackMock).toHaveBeenCalledTimes(2);

                // with the value of just the .a value
                expect(connectionCallbackMock).toHaveBeenCalledWith('one', ONYX_KEYS.TEST_KEY);
            })

            // When the .a property changes
            .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'two'}))
            .then(() => {
                // Then the callback should be called one more time
                expect(connectionCallbackMock).toHaveBeenCalledTimes(3);

                // Then the callback should be called with the value of just the .a value
                expect(connectionCallbackMock).toHaveBeenCalledWith('two', ONYX_KEYS.TEST_KEY);
            })

            // When the .b property, which we aren't listening to, changes
            .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {b: 'three'}))
            .then(() => {
                // Then the callback should still only have been called once
                expect(connectionCallbackMock).toHaveBeenCalledTimes(3);
            });

        it('when using a selector, callback is only called when the specific property changes', () => {
            // Given an onyx connection with a mocked callback and using a selector
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.TEST_KEY,
                selector: 'a',
                callback: connectionCallbackMock,
            };

            runAssertionsWithMapping(connectionMapping, connectionCallbackMock);
        });

        it('when using a reducer, callback is only called when the specific property changes', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.TEST_KEY,
                reducer: obj => obj.a,
                callback: connectionCallbackMock,
            };

            runAssertionsWithMapping(connectionMapping, connectionCallbackMock);
        });

        it('when connecting to a collection with a selector', () => {
            // Given an onyx connection for a collection with a mocked callback and a selector that is only interested in the ".a" property
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                selector: 'a',
                callback: connectionCallbackMock,
            };

            return waitForPromisesToResolve()

                // When that mapping is connected to Onyx
                .then(() => {
                    connectionID = Onyx.connect(connectionMapping);
                    return waitForPromisesToResolve();
                })
                .then(() => {
                    // Then the callback should be called once
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(1);

                    // With no values (since nothing is set in Onyx yet)
                    expect(connectionCallbackMock).toHaveBeenCalledWith(undefined, undefined);
                })

                // When Onyx is updated with a collection that has two objects, all with different keys
                .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                }))
                .then(() => {
                    // Then the callback should be called once more
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(2);

                    // With a collection that only contains the single object with the ".a" property and it only contains that property
                    expect(connectionCallbackMock).toHaveBeenCalledWith('one', `${ONYX_KEYS.COLLECTION.TEST_KEY}1`);
                });
        });

        it('when connecting to a collection with a reducer', () => {
            // Given an onyx connection for a collection with a mocked callback and a selector that is only interested in the ".a" property
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                reducer: obj => obj.a,
                callback: connectionCallbackMock,
            };

            return waitForPromisesToResolve()

                // When that mapping is connected to Onyx
                .then(() => {
                    connectionID = Onyx.connect(connectionMapping);
                    return waitForPromisesToResolve();
                })
                .then(() => {
                    // Then the callback should be called once
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(1);

                    // With no values (since nothing is set in Onyx yet)
                    expect(connectionCallbackMock).toHaveBeenCalledWith(undefined, undefined);
                })

                // When Onyx is updated with a collection that has two objects, all with different keys
                .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                }))
                .then(() => {
                    // Then the callback should be called once more
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(2);

                    // With a collection that only contains the single object with the ".a" property and it only contains that property
                    expect(connectionCallbackMock).toHaveBeenCalledWith('one', `${ONYX_KEYS.COLLECTION.TEST_KEY}1`);
                });
        });

        it('when connecting to a collection with a selector and waitForCollectionCallback = true', () => {
            // Given an onyx connection for a collection with a mocked callback and a selector that is only interested in the ".a" property
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                selector: 'a',
                waitForCollectionCallback: true,
                callback: connectionCallbackMock,
            };

            return waitForPromisesToResolve()

                // When that mapping is connected to Onyx
                .then(() => {
                    connectionID = Onyx.connect(connectionMapping);
                    return waitForPromisesToResolve();
                })
                .then(() => {
                    // Then the callback should be called once
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(1);

                    // With no values (since nothing is set in Onyx yet)
                    expect(connectionCallbackMock).toHaveBeenCalledWith(undefined, undefined);
                })

                // When Onyx is updated with a collection that has two objects, all with different keys
                .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                }))
                .then(() => {
                    // Then the callback should be called once more
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(2);

                    // With a collection that only contains the single object with the ".a" property and it only contains that property
                    expect(connectionCallbackMock).toHaveBeenNthCalledWith(2, {test_1: 'one'});
                });
        });
    });

    describe('withOnyx()', () => {
        // Cleanup (ie. unmount) all rendered components and clear out Onyx after each test so that each test starts with a clean slate
        afterEach(() => {
            cleanup();
            Onyx.clear();
        });

        const runAssertionsWithComponent = (TestComponentWithOnyx) => {
            let renderedComponent = render(<TestComponentWithOnyx />);
            return waitForPromisesToResolve()

                // When Onyx is updated with an object that has multiple properties
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'one', b: 'two'}))
                .then(() => {
                    renderedComponent = render(<TestComponentWithOnyx />);
                    return waitForPromisesToResolve();
                })

                // Then the props passed to the component should only include the property "a" that was specified
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"one"}');
                })

                // When Onyx is updated with a change to property a
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'two', b: 'two'}))
                .then(() => {
                    renderedComponent = render(<TestComponentWithOnyx />);
                    return waitForPromisesToResolve();
                })

                // Then the props passed should have the new value of property "a"
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"two"}');
                })

                // When Onyx is updated with a change to property b
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'two', b: 'two'}))
                .then(() => {
                    renderedComponent = render(<TestComponentWithOnyx />);
                    return waitForPromisesToResolve();
                })

                // Then the props passed should not have changed
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"two"}');
                });
        };

        it('when using a selector, should only be updated with the props containing the specific property', () => {
            // Given a component is using withOnyx and subscribing to the property "a" of the object in Onyx
            const TestComponentWithOnyx = withOnyx({
                propertyA: {
                    key: ONYX_KEYS.TEST_KEY,
                    selector: 'a',
                },
            })(ViewWithObject);
            return runAssertionsWithComponent(TestComponentWithOnyx);
        });

        it('when using a reducer, should only be updated with the props containing the specific property', () => {
            // Given a component is using withOnyx and subscribing to the property "a" of the object in Onyx
            const TestComponentWithOnyx = withOnyx({
                propertyA: {
                    key: ONYX_KEYS.TEST_KEY,
                    reducer: obj => obj.a,
                },
            })(ViewWithObject);
            return runAssertionsWithComponent(TestComponentWithOnyx);
        });
    });
});
