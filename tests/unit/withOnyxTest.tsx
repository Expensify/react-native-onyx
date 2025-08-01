import React from 'react';
import {act, render, configure as configureRNTL, resetToDefaults as resetRNTLToDefaults} from '@testing-library/react-native';
import Onyx, {withOnyx} from '../../lib';
import type {ViewWithTextOnyxProps, ViewWithTextProps} from '../components/ViewWithText';
import ViewWithText from '../components/ViewWithText';
import type {ViewWithCollectionsProps} from '../components/ViewWithCollections';
import ViewWithCollections from '../components/ViewWithCollections';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import type {ViewWithObjectProps} from '../components/ViewWithObject';
import ViewWithObject from '../components/ViewWithObject';
import StorageMock from '../../lib/storage';
import type {OnyxValue} from '../../lib/types';
import type GenericCollection from '../utils/GenericCollection';

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
    skippableCollectionMemberIDs: ['skippable-id'],
});

beforeEach(() => Onyx.clear());

describe('withOnyxTest', () => {
    beforeAll(() => {
        // Disables concurrent rendering as it breaks withOnyx() tests.
        configureRNTL({
            concurrentRoot: false,
        });
    });

    afterAll(() => {
        resetRNTLToDefaults();
    });

    it('should render immediately with the test data when using withOnyx', () => {
        const onRender = jest.fn();

        // Note: earlier, after rendering a component we had to do another
        // waitForPromisesToResolve() to wait for Onyx's next tick updating
        // the component from {loading: true} to {loading:false, ...data}.
        // We now changed the architecture, so that when a key can be retrieved
        // synchronously from cache, we expect the component to be rendered immediately.
        return Onyx.set(ONYX_KEYS.TEST_KEY, 'test1')
            .then(() => {
                const TestComponentWithOnyx = withOnyx<ViewWithTextProps, ViewWithTextOnyxProps>({
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
        const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {text: unknown}>({
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
        } as GenericCollection)
            .then(() => Onyx.merge(ONYX_KEYS.SIMPLE_KEY, 'prev_string'))
            .then(() => Onyx.merge(ONYX_KEYS.SIMPLE_KEY_2, 'prev_string2'))
            .then(() => {
                const TestComponentWithOnyx = withOnyx<ViewWithObjectProps, Record<'testKey' | 'simpleKey' | 'simpleKey2', unknown>>({
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
                        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}} as GenericCollection);
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
        const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {text: unknown}>({
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
                } as GenericCollection),
            )
            .then(() => {
                expect(onRender).toHaveBeenCalledTimes(2);
            });
    });

    it('should update withOnyx subscribing to individual key if mergeCollection is used', () => {
        const collectionItemID = 1;
        const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {text: unknown}>({
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
                } as GenericCollection),
            )
            .then(() => {
                expect(onRender).toHaveBeenCalledTimes(2);
            });
    });

    it('should replace arrays inside objects with withOnyx subscribing to individual key if mergeCollection is used', () => {
        const collectionItemID = 1;
        const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {text: unknown}>({
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
                } as GenericCollection),
            )
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {list: [7]},
                } as GenericCollection),
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
        const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {text: unknown}>({
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
            .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_4: {ID: 456}, test_5: {ID: 567}} as GenericCollection))
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_4: {Name: 'Test4'},
                    test_5: {Name: 'Test5'},
                    test_6: {ID: 678, Name: 'Test6'},
                } as GenericCollection),
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
        let rerender: ReturnType<typeof render>['rerender'];
        let getByTestId: ReturnType<typeof render>['getByTestId'];
        const TestComponentWithOnyx = withOnyx<ViewWithTextProps, ViewWithTextOnyxProps>({
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
        const TestComponentWithOnyx = withOnyx<ViewWithTextProps, ViewWithTextOnyxProps>({
            text: {
                key: 'test',
                initWithStoredValues: false,
            },
        })(ViewWithText);
        TestComponentWithOnyx.defaultProps = {
            text: INITIAL_VALUE,
        } as ViewWithTextProps;
        Onyx.set('test', 'test_text');
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
        } as GenericCollection);

        // And one collection will depend on data being loaded from the static collection
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.DEPENDS_ON_STATIC, {
            dependsOnStatic_1: {name: 'dependsOnStatic 1', id: 3},
            dependsOnStatic_2: {name: 'dependsOnStatic 2', id: 4},
        } as GenericCollection);

        // And one collection will depend on the data being loaded from the collection that depends on the static collection (multiple nested dependencies)
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.DEPENDS_ON_DEPENDS_ON_STATIC, {
            dependsOnDependsOnStatic_3: {name: 'dependsOnDependsOnStatic 1', id: 5},
            dependsOnDependsOnStatic_4: {name: 'dependsOnDependsOnStatic 2', id: 6},
        } as GenericCollection);

        // And another collection with one more layer of dependency just to prove it works
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.DEPENDS_ON_DEPENDS_ON_DEPENDS_ON_STATIC, {
            dependsOnDependsOnDependsOnStatic_5: {name: 'dependsOnDependsOnDependsOnStatic 1'},
            dependsOnDependsOnDependsOnStatic_6: {name: 'dependsOnDependsOnDependsOnStatic 2'},
        } as GenericCollection);

        // When a component is rendered using withOnyx and several nested dependencies on the keys
        return (
            waitForPromisesToResolve()
                .then(() => {
                    const TestComponentWithOnyx = withOnyx<
                        ViewWithCollectionsProps,
                        Record<'staticObject' | 'dependentObject' | 'multiDependentObject' | 'extremeMultiDependentObject', unknown>
                    >({
                        staticObject: {
                            key: `${ONYX_KEYS.COLLECTION.STATIC}1`,
                        },
                        dependentObject: {
                            key: ({staticObject}) =>
                                `${ONYX_KEYS.COLLECTION.DEPENDS_ON_STATIC}${(staticObject && typeof staticObject === 'object' && 'id' in staticObject && staticObject.id) || 0}`,
                        },
                        multiDependentObject: {
                            key: ({dependentObject}) =>
                                `${ONYX_KEYS.COLLECTION.DEPENDS_ON_DEPENDS_ON_STATIC}${
                                    (dependentObject && typeof dependentObject === 'object' && 'id' in dependentObject && dependentObject.id) || 0
                                }`,
                        },
                        extremeMultiDependentObject: {
                            key: ({multiDependentObject}) =>
                                `${ONYX_KEYS.COLLECTION.DEPENDS_ON_DEPENDS_ON_DEPENDS_ON_STATIC}${
                                    (multiDependentObject && typeof multiDependentObject === 'object' && 'id' in multiDependentObject && multiDependentObject.id) || 0
                                }`,
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
        } as GenericCollection);

        return (
            waitForPromisesToResolve()
                .then(() => {
                    // When three components subscribe to each of the items in that collection
                    const TestComponentWithOnyx1 = withOnyx<ViewWithCollectionsProps, {testObject: unknown}>({
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

                    const TestComponentWithOnyx2 = withOnyx<ViewWithCollectionsProps, {testObject: unknown}>({
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

                    const TestComponentWithOnyx3 = withOnyx<ViewWithCollectionsProps, {testObject: unknown}>({
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
                    } as GenericCollection),
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
        } as GenericCollection);

        return (
            waitForPromisesToResolve()
                .then(() => {
                    // When a component subscribes to the one item in that collection
                    const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {testObject: unknown}>({
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
                    } as GenericCollection),
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
                    const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {simple: unknown}>({
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

    it('should render immediately when a onyx component is mounted a 2nd time', () => {
        const TestComponentWithOnyx = withOnyx<ViewWithTextProps, ViewWithTextOnyxProps>({
            text: {
                key: ONYX_KEYS.TEST_KEY,
            },
        })(ViewWithText);
        const onRender = jest.fn();
        let renderResult: ReturnType<typeof render>;

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
        const TestComponentWithOnyx = withOnyx<ViewWithTextProps, ViewWithTextOnyxProps>({
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
        const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {text: unknown}>({
            text: {
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
            },
        })(ViewWithCollections);
        const onRender = jest.fn();
        let renderResult: ReturnType<typeof render>;

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

    it('works with selectors', async () => {
        const selector = jest.fn().mockImplementation((value) => (value ? value.hello : undefined));
        const TestComponentWithOnyx = withOnyx<ViewWithTextProps, ViewWithTextOnyxProps>({
            // Note: the prop passed to the wrapped component is called "text",
            // which is different than the key selected by the selector "hello"
            text: {
                key: ONYX_KEYS.TEST_KEY,
                selector,
            },
        })(ViewWithText);
        let sourceData: OnyxValue<typeof ONYX_KEYS.TEST_KEY> = {hello: 'world', goodnight: 'moon'};
        await StorageMock.setItem(ONYX_KEYS.TEST_KEY, sourceData);

        const onRender = jest.fn();
        const renderResult = render(<TestComponentWithOnyx onRender={onRender} />);

        // When the data is first loading and not yet in cache, it's expected that the selector be called with undefined
        expect(onRender).not.toHaveBeenCalled();
        expect(selector).toHaveBeenCalledTimes(1);
        expect(selector).toHaveBeenCalledWith(undefined, undefined);
        selector.mockClear();

        // Then the selector is called with the correct data
        await waitForPromisesToResolve();
        await waitForPromisesToResolve();
        expect(onRender).toHaveBeenCalledTimes(1);
        onRender.mockClear();

        // And the component is rendered correctly
        expect(selector).toHaveBeenCalledTimes(1);
        expect(selector).toHaveBeenCalledWith(sourceData, {loading: true, text: 'world'});
        let textComponent = renderResult.getByText('world');
        expect(textComponent).not.toBeNull();
        selector.mockClear();

        // When we update some data that's not targeted by the selector
        await Onyx.merge(ONYX_KEYS.TEST_KEY, {goodnight: 'dougal'});
        await waitForPromisesToResolve();

        // Correct data has been passed to the selector
        expect(selector).not.toHaveBeenCalledWith('world', expect.anything());
        expect(selector).not.toHaveBeenCalledWith('moon', expect.anything());
        expect(selector).toHaveReturnedWith('world');
        selector.mockClear();

        // And the component has not re-render
        expect(onRender).not.toHaveBeenCalled();

        // When we delete the data
        sourceData = null;
        await Onyx.set(ONYX_KEYS.TEST_KEY, sourceData);
        await waitForPromisesToResolve();

        // Correct data has been passed to the selector
        expect(selector).not.toHaveBeenCalledWith('world', expect.anything());
        expect(selector).not.toHaveBeenCalledWith('dougal', expect.anything());
        expect(selector).toHaveBeenLastCalledWith(undefined, {loading: false, text: 'world'});

        // Default text has been rendered
        expect(onRender).toHaveBeenCalledTimes(1);
        textComponent = renderResult.getByText('null');
        expect(textComponent).not.toBeNull();
    });

    describe('skippable collection member ids', () => {
        it('should always return undefined entry when subscribing to a collection with skippable member ids', async () => {
            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {ID: 'entry1_id'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry2`]: {ID: 'entry2_id'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`]: {ID: 'skippable-id_id'},
            } as GenericCollection);

            const TestComponentWithOnyx = withOnyx<ViewWithCollectionsProps, {collections: unknown}>({
                collections: {
                    key: ONYX_KEYS.COLLECTION.TEST_KEY,
                },
            })(ViewWithCollections);
            const renderResult = render(<TestComponentWithOnyx />);

            await waitForPromisesToResolve();

            expect(renderResult.queryByText('entry1_id')).not.toBeNull();
            expect(renderResult.queryByText('entry2_id')).not.toBeNull();
            expect(renderResult.queryByText('entry3_id')).toBeNull();

            await act(async () =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {ID: 'entry1_id_changed'},
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry2`]: {ID: 'entry2_id_changed'},
                    [`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`]: {ID: 'skippable-id_id_changed'},
                } as GenericCollection),
            );

            expect(renderResult.queryByText('entry1_id_changed')).not.toBeNull();
            expect(renderResult.queryByText('entry2_id_changed')).not.toBeNull();
            expect(renderResult.queryByText('skippable-id_id_changed')).toBeNull();
        });

        it('should always return undefined when subscribing to a skippable collection member id', async () => {
            const TestComponentWithOnyx = withOnyx<ViewWithTextProps, ViewWithTextOnyxProps>({
                text: {
                    key: `${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`,
                },
            })(ViewWithText);

            // @ts-expect-error bypass
            await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`, 'skippable-id_value');

            const renderResult = render(<TestComponentWithOnyx />);

            await waitForPromisesToResolve();
            await waitForPromisesToResolve();

            expect(renderResult.queryByText('skippable-id_value')).toBeNull();

            await act(async () => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`, 'skippable-id_value_changed'));

            expect(renderResult.queryByText('skippable-id_value_changed')).toBeNull();
        });
    });
});
