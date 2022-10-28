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

class ErrorBoundary extends React.Component {
    // Error boundaries have to implement this method. It's for providing a fallback UI, but
    // we don't need that for unit testing, so this is basically a no-op.
    static getDerivedStateFromError(error) {
        return {error};
    }

    componentDidCatch(error, errorInfo) {
        console.error(error, errorInfo);
    }

    render() {
        // eslint-disable-next-line react/prop-types
        return this.props.children;
    }
}

describe('Only the specific property changes when using withOnyx() and ', () => {
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
        let renderedComponent = render(<ErrorBoundary><TestComponentWithOnyx /></ErrorBoundary>);
        return waitForPromisesToResolve()

            // When Onyx is updated with an object that has multiple properties
            .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'one', b: 'two'}))
            .then(() => {
                renderedComponent = render(<ErrorBoundary><TestComponentWithOnyx /></ErrorBoundary>);
                return waitForPromisesToResolve();
            })

            // Then the props passed to the component should only include the property "a" that was specified
            .then(() => {
                expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"one"}');
            })

            // When Onyx is updated with a change to property a
            .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'two'}))
            .then(() => {
                renderedComponent = render(<ErrorBoundary><TestComponentWithOnyx /></ErrorBoundary>);
                return waitForPromisesToResolve();
            })

            // Then the props passed should have the new value of property "a"
            .then(() => {
                expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"two"}');
            })

            // When Onyx is updated with a change to property b
            .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {b: 'two'}))
            .then(() => {
                renderedComponent = render(<ErrorBoundary><TestComponentWithOnyx /></ErrorBoundary>);
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
                selector: obj => obj && obj.a,
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
        let renderedComponent = render(<ErrorBoundary><TestComponentWithOnyx /></ErrorBoundary>);
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
                renderedComponent = render(<ErrorBoundary><TestComponentWithOnyx /></ErrorBoundary>);
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
                selector: obj => obj && obj.a,
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
        let renderedComponent = render(<ErrorBoundary><TestComponentWithOnyx /></ErrorBoundary>);
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
                renderedComponent = render(<ErrorBoundary><TestComponentWithOnyx /></ErrorBoundary>);
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
                selector: obj => obj && obj.a,
            },
        })(ViewWithObject);
        return runAllAssertionsForCollectionKey(TestComponentWithOnyx);
    });
});
