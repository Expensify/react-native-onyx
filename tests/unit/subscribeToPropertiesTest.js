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

describe('Only the specific property changes when', () => {
    describe('using Onyx.connect() and ', () => {
        let connectionID;

        afterEach(() => {
            Onyx.disconnect(connectionID);
            return Onyx.clear();
        });

        /**
         * Runs all the assertions needed for Onyx.connect() callbacks
         * @param {Object} mapping
         * @param {jest.Mock} connectionCallbackMock
         * @returns {Promise}
         */
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

                // with value of just the .a value
                expect(connectionCallbackMock).toHaveBeenCalledWith('two', ONYX_KEYS.TEST_KEY);
            })

            // When the .b property, which we aren't listening to, changes
            .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {b: 'three'}))
            .then(() => {
                // Then the callback should not have been called anymore
                expect(connectionCallbackMock).toHaveBeenCalledTimes(3);
            });

        it('connecting to a single non-collection key with a selector string', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.TEST_KEY,
                selector: 'a',
                callback: connectionCallbackMock,
            };

            runAssertionsWithMapping(connectionMapping, connectionCallbackMock);
        });

        it('connecting to a single non-collection key with a selector function', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.TEST_KEY,
                selector: obj => obj.a,
                callback: connectionCallbackMock,
            };

            runAssertionsWithMapping(connectionMapping, connectionCallbackMock);
        });

        /**
         * Runs all the assertions needed for Onyx.connect() callbacks when using collections
         * @param {Object} mapping
         * @param {jest.Mock} connectionCallbackMock
         * @returns {Promise}
         */
        const runCollectionAssertionsWithMapping = (mapping, connectionCallbackMock) => waitForPromisesToResolve()

            // When that mapping is connected to Onyx
            .then(() => {
                connectionID = Onyx.connect(mapping);
                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then the callback should not be called yet because there is no data in Onyx
                expect(connectionCallbackMock).toHaveBeenCalledTimes(0);
            })

            // When Onyx is updated with a collection that has two objects, all with different keys
            .then(() => {
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                });
                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then the callback should be called once more
                expect(connectionCallbackMock).toHaveBeenCalledTimes(1);

                // With a collection that only contains the single object with the ".a" property and it only contains
                // that property
                expect(connectionCallbackMock).toHaveBeenCalledWith('one', `${ONYX_KEYS.COLLECTION.TEST_KEY}1`);
            });

        it('connecting to a collection with a selector string', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                selector: 'a',
                callback: connectionCallbackMock,
            };

            return runCollectionAssertionsWithMapping(connectionMapping, connectionCallbackMock);
        });

        it('connecting to a collection with a selector function', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                selector: obj => obj.a,
                callback: connectionCallbackMock,
            };

            return runCollectionAssertionsWithMapping(connectionMapping, connectionCallbackMock);
        });

        /**
         * Runs all the assertions needed for Onyx.connect() callbacks when using collections and
         * waitForCollectionCallback: true
         * @param {Object} mapping
         * @param {jest.Mock} connectionCallbackMock
         * @returns {Promise}
         */
        // eslint-disable-next-line max-len
        const runCollectionAssertionsWithMappingAndWaitForCollection = (mapping, connectionCallbackMock) => waitForPromisesToResolve()

            // When that mapping is connected to Onyx
            .then(() => {
                connectionID = Onyx.connect(mapping);
                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then the callback should have been called once
                expect(connectionCallbackMock).toHaveBeenCalledTimes(1);
            })

            // When Onyx is updated with a collection that has two objects, all with different keys
            .then(() => {
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                });
                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then the callback should be called once more
                expect(connectionCallbackMock).toHaveBeenCalledTimes(2);

                // With a collection that only contains the single object with the ".a" property and it only contains
                // that property
                expect(connectionCallbackMock).toHaveBeenCalledWith({[`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: 'one'});
            });

        it('connecting to a collection with a selector string and waitForCollectionCallback = true', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                selector: 'a',
                waitForCollectionCallback: true,
                callback: connectionCallbackMock,
            };

            return runCollectionAssertionsWithMappingAndWaitForCollection(connectionMapping, connectionCallbackMock);
        });

        it('connecting to a collection with a selector function and waitForCollectionCallback = true', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                selector: obj => obj.a,
                waitForCollectionCallback: true,
                callback: connectionCallbackMock,
            };

            return runCollectionAssertionsWithMappingAndWaitForCollection(connectionMapping, connectionCallbackMock);
        });

        /**
         * Runs all the assertions needed for Onyx.connect() callbacks when using collections and
         * waitForCollectionCallback: true
         * @param {Object} mapping
         * @param {jest.Mock} connectionCallbackMock
         * @returns {Promise}
         */
        // eslint-disable-next-line max-len
        const runCollectionMemberAssertions = (mapping, connectionCallbackMock) => waitForPromisesToResolve()

            // When that mapping is connected to Onyx
            .then(() => {
                connectionID = Onyx.connect(mapping);
                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then the callback should not be called since there is no data in Onyx
                expect(connectionCallbackMock).toHaveBeenCalledTimes(0);
            })

            // When Onyx is updated with a collection that has two objects, all with different keys
            .then(() => {
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                });
                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then the callback should be called once more
                expect(connectionCallbackMock).toHaveBeenCalledTimes(1);

                // With the value of the ".a" property
                expect(connectionCallbackMock).toHaveBeenCalledWith('one', 'test_1');
            });

        it('connecting to a collection member with a selector string', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                selector: 'a',
                callback: connectionCallbackMock,
            };

            return runCollectionMemberAssertions(connectionMapping, connectionCallbackMock);
        });

        it('connecting to a collection member with a selector function', () => {
            const connectionCallbackMock = jest.fn();
            const connectionMapping = {
                key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                selector: obj => obj.a,
                callback: connectionCallbackMock,
            };

            return runCollectionMemberAssertions(connectionMapping, connectionCallbackMock);
        });
    });

    describe('using withOnyx() and ', () => {
        // Cleanup (ie. unmount) all rendered components and clear out Onyx after each test so that each test starts
        // with a clean slate
        afterEach(() => {
            cleanup();
            Onyx.clear();
        });

        /**
         * Runs all the assertions needed for withOnyx and using single keys in Onyx
         * @param {Object} TestComponentWithOnyx
         * @returns {Promise}
         */
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
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'two'}))
                .then(() => {
                    renderedComponent = render(<TestComponentWithOnyx />);
                    return waitForPromisesToResolve();
                })

                // Then the props passed should have the new value of property "a"
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"two"}');
                })

                // When Onyx is updated with a change to property b
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {b: 'two'}))
                .then(() => {
                    renderedComponent = render(<TestComponentWithOnyx />);
                    return waitForPromisesToResolve();
                })

                // Then the props passed should not have changed
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"two"}');
                });
        };

        it('connecting to a single non-collection key with a selector string', () => {
            const TestComponentWithOnyx = withOnyx({
                propertyA: {
                    key: ONYX_KEYS.TEST_KEY,
                    selector: 'a',
                },
            })(ViewWithObject);
            return runAssertionsWithComponent(TestComponentWithOnyx);
        });

        it('connecting to a single non-collection key with a selector function', () => {
            const TestComponentWithOnyx = withOnyx({
                propertyA: {
                    key: ONYX_KEYS.TEST_KEY,
                    selector: obj => obj.a,
                },
            })(ViewWithObject);
            return runAssertionsWithComponent(TestComponentWithOnyx);
        });

        /**
         * Runs all the assertions for connecting to a full collection
         *
         * @param {Object} TestComponentWithOnyx
         * @returns {Promise}
         */
        const runAllAssertionsForCollection = (TestComponentWithOnyx) => {
            let renderedComponent = render(<TestComponentWithOnyx />);
            return waitForPromisesToResolve()

                // When Onyx is updated with an object that has multiple properties
                .then(() => {
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                    });
                    return waitForPromisesToResolve();
                })
                .then(() => {
                    renderedComponent = render(<TestComponentWithOnyx />);
                    return waitForPromisesToResolve();
                })

                // Then the props passed to the component should only include the property "a" that was specified
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"collectionWithPropertyA":{"test_1":"one"}}');
                })

                // When Onyx is updated with a change to property a using merge()
                // This uses merge() just to make sure that everything works as expected when mixing merge()
                // and mergeCollection()
                .then(() => {
                    Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {a: 'two'});
                    return waitForPromisesToResolve();
                })

                // Then the props passed should have the new value of property "a"
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"collectionWithPropertyA":{"test_1":"two"}}');
                })

                // When Onyx is updated with a change to property b using mergeCollection()
                .then(() => {
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {b: 'three'},
                    });
                    return waitForPromisesToResolve();
                })

                // Then the props passed should not have changed
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"collectionWithPropertyA":{"test_1":"two"}}');
                });
        };

        it('connecting to a collection with a selector string', () => {
            const TestComponentWithOnyx = withOnyx({
                collectionWithPropertyA: {
                    key: ONYX_KEYS.COLLECTION.TEST_KEY,
                    selector: 'a',
                },
            })(ViewWithObject);
            return runAllAssertionsForCollection(TestComponentWithOnyx);
        });

        it('connecting to a collection with a selector function', () => {
            const TestComponentWithOnyx = withOnyx({
                collectionWithPropertyA: {
                    key: ONYX_KEYS.COLLECTION.TEST_KEY,
                    selector: obj => obj.a,
                },
            })(ViewWithObject);
            return runAllAssertionsForCollection(TestComponentWithOnyx);
        });

        /**
         * Runs all the assertions when connecting to a key that is part of a collection
         *
         * @param {Object} TestComponentWithOnyx
         * @returns {Promise}
         */
        const runAllAssertionsForCollectionKey = (TestComponentWithOnyx) => {
            let renderedComponent = render(<TestComponentWithOnyx />);
            return waitForPromisesToResolve()

                // When Onyx is updated with an object that has multiple properties
                .then(() => {
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                    });
                    return waitForPromisesToResolve();
                })
                .then(() => {
                    renderedComponent = render(<TestComponentWithOnyx />);
                    return waitForPromisesToResolve();
                })

                // Then the props passed to the component should only include the property "a" that was specified
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"itemWithPropertyA":"one"}');
                })

                // When Onyx is updated with a change to property a using merge()
                // This uses merge() just to make sure that everything works as expected when mixing merge()
                // and mergeCollection()
                .then(() => {
                    Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {a: 'two'});
                    return waitForPromisesToResolve();
                })

                // Then the props passed should have the new value of property "a"
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"itemWithPropertyA":"two"}');
                })

                // When Onyx is updated with a change to property b using mergeCollection()
                .then(() => {
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {b: 'three'},
                    });
                    return waitForPromisesToResolve();
                })

                // Then the props passed should not have changed
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"itemWithPropertyA":"two"}');
                });
        };

        it('connecting to a collection member with a selector string', () => {
            const TestComponentWithOnyx = withOnyx({
                itemWithPropertyA: {
                    key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                    selector: 'a',
                },
            })(ViewWithObject);
            return runAllAssertionsForCollectionKey(TestComponentWithOnyx);
        });

        it('connecting to a collection member with a selector function', () => {
            const TestComponentWithOnyx = withOnyx({
                itemWithPropertyA: {
                    key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                    selector: obj => obj.a,
                },
            })(ViewWithObject);
            return runAllAssertionsForCollectionKey(TestComponentWithOnyx);
        });
    });
});
