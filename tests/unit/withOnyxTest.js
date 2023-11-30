/* eslint-disable rulesdir/onyx-props-must-have-default */
import React from 'react';
import {render} from '@testing-library/react-native';
import Onyx, {withOnyx} from '../../lib';
import ViewWithText from '../components/ViewWithText';
import ViewWithCollections from '../components/ViewWithCollections';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import ViewWithObject from '../components/ViewWithObject';
import StorageMock from '../../lib/storage';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
        STATIC: 'static_',
        DEPENDS_ON_STATIC: 'dependsOnStatic_',
        DEPENDS_ON_DEPENDS_ON_STATIC: 'dependsOnDependsOnStatic_',
        DEPENDS_ON_DEPENDS_ON_DEPENDS_ON_STATIC: 'dependsOnDependsOnDependsOnStatic_',
    },
    SIMPLE_KEY: 'simple',
    SIMPLE_KEY_2: 'simple2',
};

Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
});

beforeEach(() => Onyx.clear());

describe('withOnyxTest', () => {
    it('should render immediately with the test data when using withOnyx', () => {
        const onRender = jest.fn();

        // Note: earlier, after rendering a component we had to do another
        // waitForPromisesToResolve() to wait for Onyx's next tick updating
        // the component from {loading: true} to {loading:false, ...data}.
        // We now changed the architecture, so that when a key can be retrieved
        // synchronously from cache, we expect the component to be rendered immediately.
        return Onyx.set(ONYX_KEYS.TEST_KEY, 'test1')
            .then(() => {
                const TestComponentWithOnyx = withOnyx({
                    text: {
                        key: ONYX_KEYS.TEST_KEY,
                    },
                })(ViewWithText);

                const result = render(<TestComponentWithOnyx onRender={onRender} />);
                const textComponent = result.getByText('test1');
                expect(textComponent).not.toBeNull();

                return waitForPromisesToResolve();
            })
            .then(() => {
                // As the component immediately rendered from cache, we want to make
                // sure it wasn't updated a second time with the same value (the connect
                // calls gets the data another time and tries to forward it to the component,
                // which could cause a re-render if the right checks aren't in place):
                expect(onRender).toHaveBeenCalledTimes(1);
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

        return waitForPromisesToResolve()
            .then(() => {
                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {ID: 123});
                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`, {ID: 234});
                return Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}3`, {ID: 345});
            })
            .then(() => {
                // We expect 2 due to batching
                expect(onRender).toHaveBeenCalledTimes(2);
            });
    });

    it('should batch correctly together little khachapuris', () =>
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {ID: 999},
        })
            .then(() => Onyx.merge(ONYX_KEYS.SIMPLE_KEY, 'prev_string'))
            .then(() => Onyx.merge(ONYX_KEYS.SIMPLE_KEY_2, 'prev_string2'))
            .then(() => {
                const TestComponentWithOnyx = withOnyx({
                    testKey: {
                        key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                    },
                    simpleKey: {
                        key: ONYX_KEYS.SIMPLE_KEY,
                    },
                    simpleKey2: {
                        key: ONYX_KEYS.SIMPLE_KEY_2,
                    },
                })(ViewWithObject);
                const onRender = jest.fn();
                render(<TestComponentWithOnyx onRender={onRender} />);

                return waitForPromisesToResolve()
                    .then(() => {
                        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}});
                        Onyx.merge(ONYX_KEYS.SIMPLE_KEY, 'string');
                        return Onyx.merge(ONYX_KEYS.SIMPLE_KEY_2, 'string2');
                    })
                    .then(() => {
                        // We expect it to be 2 as we first is initial render and second are 3 Onyx merges batched together.
                        // As you see onyx merges on the top of the function doesn't account they are done earlier
                        expect(onRender).toHaveBeenCalledTimes(2);
                    });
            }));

    it('should update withOnyx subscriber just once when mergeCollection is used', () => {
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
            },
        })(ViewWithCollections);
        const onRender = jest.fn();
        render(<TestComponentWithOnyx onRender={onRender} />);
        return waitForPromisesToResolve()
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {ID: 123},
                    test_2: {ID: 234},
                    test_3: {ID: 345},
                }),
            )
            .then(() => {
                expect(onRender).toHaveBeenCalledTimes(2);
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
        return waitForPromisesToResolve()
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {ID: 123},
                    test_2: {ID: 234},
                    test_3: {ID: 345},
                }),
            )
            .then(() => {
                expect(onRender).toHaveBeenCalledTimes(2);
            });
    });

    it('should replace arrays inside objects with withOnyx subscribing to individual key if mergeCollection is used', () => {
        const collectionItemID = 1;
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: `${ONYX_KEYS.COLLECTION.TEST_KEY}${collectionItemID}`,
            },
        })(ViewWithCollections);
        const onRender = jest.fn();
        const markReadyForHydration = jest.fn();
        render(
            <TestComponentWithOnyx
                onRender={onRender}
                markReadyForHydration={markReadyForHydration}
            />,
        );
        return waitForPromisesToResolve()
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {list: [1, 2]},
                }),
            )
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {list: [7]},
                }),
            )
            .then(() => {
                expect(onRender).toHaveBeenCalledTimes(3);
                expect(onRender).toHaveBeenLastCalledWith({
                    collections: {},
                    markReadyForHydration,
                    onRender,
                    testObject: {isDefaultProp: true},
                    text: {list: [7]},
                });
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
        const markReadyForHydration = jest.fn();
        render(
            <TestComponentWithOnyx
                markReadyForHydration={markReadyForHydration}
                onRender={onRender}
            />,
        );
        return waitForPromisesToResolve()
            .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_4: {ID: 456}, test_5: {ID: 567}}))
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_4: {Name: 'Test4'},
                    test_5: {Name: 'Test5'},
                    test_6: {ID: 678, Name: 'Test6'},
                }),
            )
            .then(() => {
                expect(onRender).toHaveBeenCalledTimes(3);
                expect(onRender).toHaveBeenLastCalledWith({
                    collections: {},
                    markReadyForHydration,
                    onRender,
                    testObject: {isDefaultProp: true},
                    text: {ID: 456, Name: 'Test4'},
                });
            });
    });

    it('should update if a prop dependent key changes', () => {
        let rerender;
        let getByTestId;
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: (props) => `${ONYX_KEYS.COLLECTION.TEST_KEY}${props.collectionID}`,
            },
        })(ViewWithText);
        Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, 'test_1');
        Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`, 'test_2');
        return waitForPromisesToResolve()
            .then(() => {
                const result = render(<TestComponentWithOnyx collectionID="1" />);
                rerender = result.rerender;
                getByTestId = result.getByTestId;
            })
            .then(() => {
                expect(getByTestId('text-element').props.children).toEqual('test_1');
            })
            .then(() => {
                rerender(<TestComponentWithOnyx collectionID="2" />);

                // Note, when we change the prop, we need to wait for the next tick:
                return waitForPromisesToResolve();
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                expect(getByTestId('text-element').props.children).toEqual('test_2');
            });
    });

    it('should render the WrappedComponent if no keys are required for init', () => {
        const INITIAL_VALUE = 'initial_value';
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: 'test',
                initWithStoredValues: false,
            },
        })(ViewWithText);
        TestComponentWithOnyx.defaultProps = {
            text: INITIAL_VALUE,
        };
        Onyx.set('test_key', 'test_text');
        return waitForPromisesToResolve().then(() => {
            const {getByTestId} = render(<TestComponentWithOnyx collectionID="1" />);
            expect(getByTestId('text-element').props.children).toEqual(INITIAL_VALUE);
        });
    });

    it('should pass a prop from one connected component to another', () => {
        const onRender = jest.fn();
        const markReadyForHydration = jest.fn();

        // Given several collections with multiple items in each
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.STATIC, {
            static_1: {name: 'Static 1', id: 1},
            static_2: {name: 'Static 2', id: 2},
        });

        // And one collection will depend on data being loaded from the static collection
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.DEPENDS_ON_STATIC, {
            dependsOnStatic_1: {name: 'dependsOnStatic 1', id: 3},
            dependsOnStatic_2: {name: 'dependsOnStatic 2', id: 4},
        });

        // And one collection will depend on the data being loaded from the collection that depends on the static collection (multiple nested dependencies)
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.DEPENDS_ON_DEPENDS_ON_STATIC, {
            dependsOnDependsOnStatic_3: {name: 'dependsOnDependsOnStatic 1', id: 5},
            dependsOnDependsOnStatic_4: {name: 'dependsOnDependsOnStatic 2', id: 6},
        });

        // And another collection with one more layer of dependency just to prove it works
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.DEPENDS_ON_DEPENDS_ON_DEPENDS_ON_STATIC, {
            dependsOnDependsOnDependsOnStatic_5: {name: 'dependsOnDependsOnDependsOnStatic 1'},
            dependsOnDependsOnDependsOnStatic_6: {name: 'dependsOnDependsOnDependsOnStatic 2'},
        });

        // When a component is rendered using withOnyx and several nested dependencies on the keys
        return (
            waitForPromisesToResolve()
                .then(() => {
                    const TestComponentWithOnyx = withOnyx({
                        staticObject: {
                            key: `${ONYX_KEYS.COLLECTION.STATIC}1`,
                        },
                        dependentObject: {
                            key: ({staticObject}) => `${ONYX_KEYS.COLLECTION.DEPENDS_ON_STATIC}${(staticObject && staticObject.id) || 0}`,
                        },
                        multiDependentObject: {
                            key: ({dependentObject}) => `${ONYX_KEYS.COLLECTION.DEPENDS_ON_DEPENDS_ON_STATIC}${(dependentObject && dependentObject.id) || 0}`,
                        },
                        extremeMultiDependentObject: {
                            key: ({multiDependentObject}) => `${ONYX_KEYS.COLLECTION.DEPENDS_ON_DEPENDS_ON_DEPENDS_ON_STATIC}${(multiDependentObject && multiDependentObject.id) || 0}`,
                        },
                    })(ViewWithCollections);
                    render(
                        <TestComponentWithOnyx
                            markReadyForHydration={markReadyForHydration}
                            onRender={onRender}
                        />,
                    );

                    // First promise is for the staticObject and dependentObject to load
                    return waitForPromisesToResolve();
                })

                // Second promise is for multiDependentObject to load
                .then(waitForPromisesToResolve)

                // Third promise is for extremeMultiDependentObject to load
                .then(waitForPromisesToResolve)

                // Then all of the data gets properly loaded into the component as expected with the nested dependencies resolved
                .then(() => {
                    expect(onRender).toHaveBeenLastCalledWith({
                        markReadyForHydration,
                        onRender,
                        collections: {},
                        testObject: {isDefaultProp: true},
                        staticObject: {name: 'Static 1', id: 1},
                        dependentObject: {name: 'dependsOnStatic 1', id: 3},
                        multiDependentObject: {name: 'dependsOnDependsOnStatic 1', id: 5},
                        extremeMultiDependentObject: {name: 'dependsOnDependsOnDependsOnStatic 1'},
                    });
                })
        );
    });

    it('using mergeCollection to modify one item should only effect one component', () => {
        const onRender1 = jest.fn();
        const onRender2 = jest.fn();
        const onRender3 = jest.fn();
        const markReadyForHydration1 = jest.fn();
        const markReadyForHydration2 = jest.fn();
        const markReadyForHydration3 = jest.fn();

        // Given there is a collection with three simple items in it
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: {ID: 1},
            test_2: {ID: 2},
            test_3: {ID: 3},
        });

        return (
            waitForPromisesToResolve()
                .then(() => {
                    // When three components subscribe to each of the items in that collection
                    const TestComponentWithOnyx1 = withOnyx({
                        testObject: {
                            key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                        },
                    })(ViewWithCollections);
                    render(
                        <TestComponentWithOnyx1
                            markReadyForHydration={markReadyForHydration1}
                            onRender={onRender1}
                        />,
                    );

                    const TestComponentWithOnyx2 = withOnyx({
                        testObject: {
                            key: `${ONYX_KEYS.COLLECTION.TEST_KEY}2`,
                        },
                    })(ViewWithCollections);
                    render(
                        <TestComponentWithOnyx2
                            markReadyForHydration={markReadyForHydration2}
                            onRender={onRender2}
                        />,
                    );

                    const TestComponentWithOnyx3 = withOnyx({
                        testObject: {
                            key: `${ONYX_KEYS.COLLECTION.TEST_KEY}3`,
                        },
                    })(ViewWithCollections);
                    render(
                        <TestComponentWithOnyx3
                            markReadyForHydration={markReadyForHydration3}
                            onRender={onRender3}
                        />,
                    );
                })

                // When a single item in the collection is updated with mergeCollection()
                .then(() =>
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        test_1: {ID: 1, newProperty: 'yay'},
                    }),
                )
                .then(() => {
                    // Then the component subscribed to the modified item should have the new version of the item
                    // and all other components should be unchanged.
                    // Note: each component is rendered twice. Once when it is initially rendered, and then again
                    // when the collection is updated. That's why there are two checks here for each component.
                    expect(onRender1).toHaveBeenCalledTimes(2);
                    expect(onRender1).toHaveBeenNthCalledWith(1, {
                        collections: {},
                        markReadyForHydration: markReadyForHydration1,
                        onRender: onRender1,
                        testObject: {ID: 1},
                    });
                    expect(onRender1).toHaveBeenNthCalledWith(2, {
                        collections: {},
                        markReadyForHydration: markReadyForHydration1,
                        onRender: onRender1,
                        testObject: {ID: 1, newProperty: 'yay'},
                    });

                    expect(onRender2).toHaveBeenCalledTimes(1);
                    expect(onRender2).toHaveBeenNthCalledWith(1, {
                        collections: {},
                        markReadyForHydration: markReadyForHydration2,
                        onRender: onRender2,
                        testObject: {ID: 2},
                    });

                    expect(onRender3).toHaveBeenCalledTimes(1);
                    expect(onRender3).toHaveBeenNthCalledWith(1, {
                        collections: {},
                        markReadyForHydration: markReadyForHydration3,
                        onRender: onRender3,
                        testObject: {ID: 3},
                    });
                })
        );
    });

    it('mergeCollection should merge previous props correctly to the new state', () => {
        const onRender = jest.fn();
        const markReadyForHydration = jest.fn();

        // Given there is a collection with a simple item in it that has a `number` property set to 1
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: {ID: 1, number: 1},
        });

        return (
            waitForPromisesToResolve()
                .then(() => {
                    // When a component subscribes to the one item in that collection
                    const TestComponentWithOnyx = withOnyx({
                        testObject: {
                            key: `${ONYX_KEYS.COLLECTION.TEST_KEY}1`,
                        },
                    })(ViewWithCollections);
                    render(
                        <TestComponentWithOnyx
                            markReadyForHydration={markReadyForHydration}
                            onRender={onRender}
                        />,
                    );
                })

                // When the `number` property is updated using mergeCollection to be 2
                .then(() =>
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                        test_1: {number: 2},
                    }),
                )
                .then(() => {
                    // Then the component subscribed to the modified item should be rendered twice.
                    // The first time it will render with number === 1
                    // The second time it will render with number === 2
                    expect(onRender).toHaveBeenCalledTimes(2);
                    expect(onRender).toHaveBeenNthCalledWith(1, {
                        collections: {},
                        markReadyForHydration,
                        onRender,
                        testObject: {ID: 1, number: 1},
                    });
                    expect(onRender).toHaveBeenNthCalledWith(2, {
                        collections: {},
                        markReadyForHydration,
                        onRender,
                        testObject: {ID: 1, number: 2},
                    });
                })
        );
    });

    it('merge with a simple value should not update a connected component unless the data has changed', () => {
        const onRender = jest.fn();

        // Given there is a simple key that is not an array or object value
        Onyx.merge(ONYX_KEYS.SIMPLE_KEY, 'string');

        return (
            waitForPromisesToResolve()
                .then(() => {
                    // When a component subscribes to the simple key
                    const TestComponentWithOnyx = withOnyx({
                        simple: {
                            key: ONYX_KEYS.SIMPLE_KEY,
                        },
                    })(ViewWithCollections);
                    render(<TestComponentWithOnyx onRender={onRender} />);
                })

                // And we set the value to the same value it was before
                .then(() => Onyx.merge(ONYX_KEYS.SIMPLE_KEY, 'string'))
                .then(() => {
                    // Then the component subscribed to the modified item should only render once
                    expect(onRender).toHaveBeenCalledTimes(1);
                    expect(onRender.mock.calls[0][0].simple).toBe('string');

                    // If we change the value to something new
                    return Onyx.merge(ONYX_KEYS.SIMPLE_KEY, 'long_string');
                })
                .then(() => {
                    // Then the component subscribed to the modified item should only render once
                    expect(onRender).toHaveBeenCalledTimes(2);
                    expect(onRender.mock.calls[1][0].simple).toBe('long_string');
                })
        );
    });

    it('initialValue should be fed into component', () => {
        const onRender = jest.fn();
        const markReadyForHydration = jest.fn();

        return waitForPromisesToResolve()
            .then(() => {
                // When a component subscribes to the simple key
                const TestComponentWithOnyx = withOnyx({
                    simple: {
                        key: ONYX_KEYS.SIMPLE_KEY,
                        initialValue: 'initialValue',
                    },
                })(ViewWithCollections);
                render(
                    <TestComponentWithOnyx
                        markReadyForHydration={markReadyForHydration}
                        onRender={onRender}
                    />,
                );
            })
            .then(() => {
                // Then the component subscribed to the modified item should only render once
                expect(onRender).toHaveBeenCalledTimes(1);
                expect(onRender).toHaveBeenLastCalledWith({
                    collections: {},
                    markReadyForHydration,
                    onRender,
                    testObject: {isDefaultProp: true},
                    simple: 'initialValue',
                });
            });
    });

    it('shouldDelayUpdates + initialValue does not feed data into component until marked ready', () => {
        const onRender = jest.fn();
        const ref = React.createRef();

        return (
            waitForPromisesToResolve()
                .then(() => {
                    // When a component subscribes to the simple key
                    const TestComponentWithOnyx = withOnyx(
                        {
                            simple: {
                                key: ONYX_KEYS.SIMPLE_KEY,
                                initialValue: 'initialValue',
                            },
                        },
                        true,
                    )(ViewWithCollections);

                    render(
                        <TestComponentWithOnyx
                            onRender={onRender}
                            ref={ref}
                        />,
                    );
                })

                // component mounted with the initial value, while updates are queueing
                .then(() => Onyx.merge(ONYX_KEYS.SIMPLE_KEY, 'string'))
                .then(() => {
                    expect(onRender).toHaveBeenCalledTimes(1);
                    expect(onRender.mock.calls[0][0].simple).toBe('initialValue');

                    // just to test we change the value
                    return Onyx.merge(ONYX_KEYS.SIMPLE_KEY, 'long_string');
                })
                .then(() => {
                    // Component still has not updated
                    expect(onRender).toHaveBeenCalledTimes(1);

                    // We can now tell component to update
                    ref.current.markReadyForHydration();
                })
                .then(() => {
                    // Component still has not updated
                    expect(onRender).toHaveBeenCalledTimes(4);
                    expect(onRender.mock.calls[3][0].simple).toBe('long_string');
                })
        );
    });

    it('should render immediately when a onyx component is mounted a 2nd time', () => {
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.TEST_KEY,
            },
        })(ViewWithText);
        const onRender = jest.fn();
        let renderResult;

        // Set the value in storage, but not in cache.
        return StorageMock.setItem(ONYX_KEYS.TEST_KEY, 'test1')
            .then(() => {
                renderResult = render(<TestComponentWithOnyx onRender={onRender} />);

                // The component should not render initially since we have no data in cache.
                // Use `waitForPromisesToResolve` before making the assertions and make sure
                // onRender was not called.
                expect(onRender).not.toHaveBeenCalled();
                return waitForPromisesToResolve();
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                let textComponent = renderResult.getByText('test1');
                expect(textComponent).not.toBeNull();
                expect(onRender).toHaveBeenCalledTimes(1);

                // Unmount the component and mount it again. It should now render immediately.
                // Do not use `waitForPromisesToResolve` before making the assertions and make sure
                // onRender was called.
                renderResult.unmount();
                renderResult = render(<TestComponentWithOnyx onRender={onRender} />);

                textComponent = renderResult.getByText('test1');
                expect(textComponent).not.toBeNull();
                expect(onRender).toHaveBeenCalledTimes(2);
            });
    });

    it('should cache missing keys', () => {
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.TEST_KEY,
            },
        })(ViewWithText);
        const onRender = jest.fn();

        // Render with a key that doesn't exist in cache or storage.
        let renderResult = render(<TestComponentWithOnyx onRender={onRender} />);

        // The component should not render initially since we have no data in cache.
        // Use `waitForPromisesToResolve` before making the assertions and make sure
        // onRender was not called.
        expect(onRender).not.toHaveBeenCalled();
        return waitForPromisesToResolve().then(() => {
            let textComponent = renderResult.getByText('null');
            expect(textComponent).not.toBeNull();
            expect(onRender).toHaveBeenCalledTimes(1);

            // Unmount the component and mount it again. It should now render immediately.
            // Do not use `waitForPromisesToResolve` before making the assertions and make sure
            // onRender was called.
            renderResult.unmount();
            renderResult = render(<TestComponentWithOnyx onRender={onRender} />);
            textComponent = renderResult.getByText('null');
            expect(textComponent).not.toBeNull();
            expect(onRender).toHaveBeenCalledTimes(2);
        });
    });

    it('should cache empty collections', () => {
        const TestComponentWithOnyx = withOnyx({
            text: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
            },
        })(ViewWithCollections);
        const onRender = jest.fn();
        let renderResult;

        // Set a random item in storage since Onyx will only think keys are loaded
        // in cache if there are at least one key.
        return StorageMock.setItem(ONYX_KEYS.SIMPLE_KEY, 'simple')
            .then(() => {
                // Render with a collection that doesn't exist in cache or storage.
                renderResult = render(<TestComponentWithOnyx onRender={onRender} />);

                // The component should not render initially since we have no data in cache.
                // Use `waitForPromisesToResolve` before making the assertions and make sure
                // onRender was not called.
                expect(onRender).not.toHaveBeenCalled();

                return waitForPromisesToResolve();
            })
            .then(() => {
                let textComponent = renderResult.getByText('empty');
                expect(textComponent).not.toBeNull();
                expect(onRender).toHaveBeenCalledTimes(1);

                // Unmount the component and mount it again. It should now render immediately.
                // Do not use `waitForPromisesToResolve` before making the assertions and make sure
                // onRender was called.
                renderResult.unmount();
                renderResult = render(<TestComponentWithOnyx onRender={onRender} />);
                textComponent = renderResult.getByText('empty');
                expect(textComponent).not.toBeNull();
                expect(onRender).toHaveBeenCalledTimes(2);
            });
    });
});
