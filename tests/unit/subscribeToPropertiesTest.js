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

        it('callback is only called when the specific property changes', () => {
            const connectionCallbackMock = jest.fn();

            return waitForPromisesToResolve()

                // Given that onyx contains an object with two properties
                .then(() => Onyx.set(ONYX_KEYS.TEST_KEY, {a: 'one', b: 'two'}))

                // When we connect to that key and specific a selector path
                .then(() => {
                    connectionID = Onyx.connect({
                        key: ONYX_KEYS.TEST_KEY,
                        selector: 'a',
                        callback: connectionCallbackMock,
                    });
                    return waitForPromisesToResolve();
                })

                .then(() => {
                    // Then the callback should be called once
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(1);

                    // with the value of just the .a value
                    expect(connectionCallbackMock).toHaveBeenCalledWith('one', ONYX_KEYS.TEST_KEY);
                })

                // When the .a property changes
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'two'}))
                .then(() => {
                    // Then the callback should be called one more time
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(2);

                    // Then the callback should be called with the value of just the .a value
                    expect(connectionCallbackMock).toHaveBeenCalledWith('two', ONYX_KEYS.TEST_KEY);
                })

                // When the .b property, which we aren't listening to, changes
                .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {b: 'three'}))
                .then(() => {
                    // Then the callback should still only have been called once
                    expect(connectionCallbackMock).toHaveBeenCalledTimes(2);
                });
        });
    });

    describe('withOnyx()', () => {
        // Cleanup (ie. unmount) all rendered components and clear out Onyx after each test so that each test starts with a clean slate
        afterEach(() => {
            cleanup();
            Onyx.clear();
        });

        it('should only be updated with the props containing the specific property', () => {
            // Given a component is using withOnyx and subscribing to the property "a" of the object in Onyx
            const TestComponentWithOnyx = withOnyx({
                data: {
                    key: ONYX_KEYS.TEST_KEY,
                    selector: 'a',
                },
            })(ViewWithObject);
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
                    expect(renderedComponent.getByTestId('text-element').props.children).toEqual('{"data":{"a":"one"}}');
                });
        });
    });
});
