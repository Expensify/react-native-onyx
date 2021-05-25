import React from 'react';
import {render} from '@testing-library/react-native';

import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import ViewWithText from '../components/ViewWithText';

describe('Onyx', () => {
    describe('Cache', () => {
        let Onyx;
        let withOnyx;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            ANOTHER_TEST: 'anotherTest',
        };

        // Always use a "fresh" (and undecorated) instance
        beforeEach(() => {
            jest.resetModules();
            const OnyxModule = require('../../index');
            Onyx = OnyxModule.default;
            withOnyx = OnyxModule.withOnyx;

            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
            });
        });

        it('Expect a single call to AsyncStorage.getItem when multiple components use the same key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some data about that key exists in Onyx
            await Onyx.set(ONYX_KEYS.TEST_KEY, 'mockValue');
            await waitForPromisesToResolve();

            // WHEN multiple components are rendered
            render(
                <>
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                </>
            );

            // THEN Async storage `getItem` should be called only once
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(1);
        });

        it('Expect a single call to AsyncStorage.getAllKeys when multiple components use the same key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some data about that key exists in Onyx
            await Onyx.set(ONYX_KEYS.TEST_KEY, 'mockValue');
            await waitForPromisesToResolve();

            // WHEN multiple components are rendered
            render(
                <>
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                </>
            );

            // THEN Async storage `getItem` should be called only once
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getAllKeys).toHaveBeenCalledTimes(1);
        });

        it('Expect multiple calls to AsyncStorage.getItem when no existing component is using a key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some data about that key exists in Onyx
            await Onyx.set(ONYX_KEYS.TEST_KEY, 'mockValue');
            await waitForPromisesToResolve();

            // WHEN a component is rendered and unmounted and no longer available
            const result = render(<TestComponentWithOnyx />);
            await waitForPromisesToResolve();
            result.unmount();
            await waitForPromisesToResolve();

            // THEN When another component using the same storage key is rendered
            render(<TestComponentWithOnyx />);

            // THEN Async storage `getItem` should be called twice
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(2);
        });
    });
});
