import type {ErrorInfo, ReactNode} from 'react';
import React from 'react';
import {render, cleanup} from '@testing-library/react-native';
import Onyx, {withOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import type {ViewWithObjectProps} from '../components/ViewWithObject';
import ViewWithObject from '../components/ViewWithObject';
import type GenericCollection from '../utils/GenericCollection';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

Onyx.init({
    keys: ONYX_KEYS,
});

interface ErrorBoundaryProps {
    children?: ReactNode;
}

// The error boundary is here so that it will catch errors thrown in the selector methods (like syntax errors).
// Normally, those errors get swallowed up by Jest and are not displayed so there was no indication that a test failed
class ErrorBoundary extends React.Component<ErrorBoundaryProps> {
    // Error boundaries have to implement this method. It's for providing a fallback UI, but
    // we don't need that for unit testing, so this is basically a no-op.
    static getDerivedStateFromError(error: Error) {
        return {error};
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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
     */
    const runAssertionsWithComponent = (TestComponentWithOnyx: React.ComponentType) => {
        let renderedComponent = render(
            <ErrorBoundary>
                <TestComponentWithOnyx />
            </ErrorBoundary>,
        );
        return (
            waitForPromisesToResolve()
                // When Onyx is updated with an object that has multiple properties
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'one', b: 'two'}))
                .then(() => {
                    renderedComponent = render(
                        <ErrorBoundary>
                            <TestComponentWithOnyx />
                        </ErrorBoundary>,
                    );
                })

                // Then the props passed to the component should only include the property "a" that was specified
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"one"}');
                })

                // When Onyx is updated with a change to property a
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'two'}))
                .then(() => {
                    renderedComponent = render(
                        <ErrorBoundary>
                            <TestComponentWithOnyx />
                        </ErrorBoundary>,
                    );
                })

                // Then the props passed should have the new value of property "a"
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"two"}');
                })

                // When Onyx is updated with a change to property b
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {b: 'two'}))
                .then(() => {
                    renderedComponent = render(
                        <ErrorBoundary>
                            <TestComponentWithOnyx />
                        </ErrorBoundary>,
                    );
                })

                // Then the props passed should not have changed
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"propertyA":"two"}');
                })
        );
    };

    it('connecting to a single non-collection key with a selector function', () => {
        const mockedSelector = jest.fn((obj) => obj && obj.a);
        const TestComponentWithOnyx = withOnyx<ViewWithObjectProps, ViewWithObjectProps>({
            propertyA: {
                key: ONYX_KEYS.TEST_KEY,
                selector: mockedSelector,
            },
        })(ViewWithObject);
        return runAssertionsWithComponent(TestComponentWithOnyx).then(() => {
            // This checks to make sure a bug doesn't occur where the entire state object was being passed to
            // the selector
            expect(mockedSelector).not.toHaveBeenCalledWith({loading: false, propertyA: null});
        });
    });

    /**
     * Runs all the assertions for connecting to a full collection
     */
    const runAllAssertionsForCollection = (TestComponentWithOnyx: React.ComponentType) => {
        let renderedComponent = render(
            <ErrorBoundary>
                <TestComponentWithOnyx />
            </ErrorBoundary>,
        );
        return (
            waitForPromisesToResolve()
                // When Onyx is updated with an object that has multiple properties
                .then(() =>
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                    } as GenericCollection),
                )
                .then(() => {
                    renderedComponent = render(
                        <ErrorBoundary>
                            <TestComponentWithOnyx />
                        </ErrorBoundary>,
                    );
                })

                // Then the props passed to the component should only include the property "a" that was specified
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"collectionWithPropertyA":{"test_1":"one"}}');
                })

                // When Onyx is updated with a change to property a using merge()
                // This uses merge() just to make sure that everything works as expected when mixing merge()
                // and mergeCollection()
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {a: 'two'}))

                // Then the props passed should have the new value of property "a"
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"collectionWithPropertyA":{"test_1":"two"}}');
                })

                // When Onyx is updated with a change to property b using mergeCollection()
                .then(() =>
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {b: 'three'},
                    } as GenericCollection),
                )

                // Then the props passed should not have changed
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"collectionWithPropertyA":{"test_1":"two"}}');
                })
        );
    };

    it('connecting to a collection with a selector function', () => {
        const mockedSelector = jest.fn((obj) => obj && obj.a);
        const TestComponentWithOnyx = withOnyx<ViewWithObjectProps, ViewWithObjectProps>({
            collectionWithPropertyA: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                selector: mockedSelector,
            },
        })(ViewWithObject);
        return runAllAssertionsForCollection(TestComponentWithOnyx).then(() => {
            // Expect that the selector always gets called with the full object
            // from the onyx state, and not with the selector result value (string in this case).

            for (const mockedCall of mockedSelector.mock.calls) {
                const firstArg = mockedCall[0];
                expect(firstArg).toBeDefined();
                expect(firstArg).toBeInstanceOf(Object);
            }

            // Check to make sure that the selector was called with the props that are passed to the rendered component
            expect(mockedSelector).toHaveBeenNthCalledWith(5, {a: 'two', b: 'two'}, {loading: false, collectionWithPropertyA: {test_1: 'one', test_2: undefined}});
        });
    });

    /**
     * Runs all the assertions when connecting to a key that is part of a collection
     */
    const runAllAssertionsForCollectionMemberKey = (TestComponentWithOnyx: React.ComponentType) => {
        let renderedComponent = render(
            <ErrorBoundary>
                <TestComponentWithOnyx />
            </ErrorBoundary>,
        );
        return (
            waitForPromisesToResolve()
                // When Onyx is updated with an object that has multiple properties
                .then(() =>
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {a: 'one', b: 'two'},
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {c: 'three', d: 'four'},
                    } as GenericCollection),
                )
                .then(() => {
                    renderedComponent = render(
                        <ErrorBoundary>
                            <TestComponentWithOnyx />
                        </ErrorBoundary>,
                    );
                })

                // Then the props passed to the component should only include the property "a" that was specified
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"itemWithPropertyA":"one"}');
                })

                // When Onyx is updated with a change to property a using merge()
                // This uses merge() just to make sure that everything works as expected when mixing merge()
                // and mergeCollection()
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {a: 'two'}))

                // Then the props passed should have the new value of property "a"
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"itemWithPropertyA":"two"}');
                })

                // When Onyx is updated with a change to property b using mergeCollection()
                .then(() =>
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {b: 'three'},
                    } as GenericCollection),
                )

                // Then the props passed should not have changed
                .then(() => {
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"itemWithPropertyA":"two"}');
                })
        );
    };

    it('connecting to a collection member with a selector function', () => {
        const TestComponentWithOnyx = withOnyx<ViewWithObjectProps, ViewWithObjectProps>({
            itemWithPropertyA: {
                key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                // @ts-expect-error bypass
                selector: (obj) => obj && obj.a,
            },
        })(ViewWithObject);
        return runAllAssertionsForCollectionMemberKey(TestComponentWithOnyx);
    });
});
