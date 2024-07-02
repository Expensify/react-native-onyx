// eslint-disable-next-line max-classes-per-file
import {act} from '@testing-library/react-native';
import Onyx from '../../lib';
import connectionManager from '../../lib/OnyxConnectionManager';
import StorageMock from '../../lib/storage';
import type {OnyxKey, WithOnyxConnectOptions} from '../../lib/types';
import type {WithOnyxInstance} from '../../lib/withOnyx/types';
import type GenericCollection from '../utils/GenericCollection';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

// eslint-disable-next-line dot-notation
const connectionsMap = connectionManager['connectionsMap'];

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_KEY_2: 'test2_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());

describe('OnyxConnectionManager', () => {
    // Always use a "fresh" instance
    beforeEach(() => {
        connectionManager.disconnectAll();
    });

    describe('connect', () => {
        it('should connect to a key and fire the callback with its value', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            const connection = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            expect(connectionsMap.has(connection.key)).toBeTruthy();

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);

            connectionManager.disconnect(connection);

            expect(connectionsMap.size).toEqual(0);
        });

        it('should connect two times to the same key and fire both callbacks with its value', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            const connection1 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            const callback2 = jest.fn();
            const connection2 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback2});

            expect(connection1.key).toEqual(connection2.key);
            expect(connectionsMap.size).toEqual(1);
            expect(connectionsMap.has(connection1.key)).toBeTruthy();

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);

            connectionManager.disconnect(connection1);
            connectionManager.disconnect(connection2);

            expect(connectionsMap.size).toEqual(0);
        });

        it('should connect two times to the same key but with different options, and fire the callbacks differently', async () => {
            const obj1 = {id: 'entry1_id', name: 'entry1_name'};
            const obj2 = {id: 'entry2_id', name: 'entry2_name'};
            const collection: GenericCollection = {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: obj1,
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: obj2,
            };
            await StorageMock.multiSet([
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`, obj1],
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`, obj2],
            ]);

            const callback1 = jest.fn();
            const connection1 = connectionManager.connect({key: ONYXKEYS.COLLECTION.TEST_KEY, callback: callback1});

            const callback2 = jest.fn();
            const connection2 = connectionManager.connect({key: ONYXKEYS.COLLECTION.TEST_KEY, callback: callback2, waitForCollectionCallback: true});

            expect(connection1.key).not.toEqual(connection2.key);
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection1.key)).toBeTruthy();
            expect(connectionsMap.has(connection2.key)).toBeTruthy();

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(2);
            expect(callback1).toHaveBeenNthCalledWith(1, obj1, `${ONYXKEYS.COLLECTION.TEST_KEY}entry1`);
            expect(callback1).toHaveBeenNthCalledWith(2, obj2, `${ONYXKEYS.COLLECTION.TEST_KEY}entry2`);

            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith(collection, undefined);

            connectionManager.disconnect(connection1);
            connectionManager.disconnect(connection2);

            expect(connectionsMap.size).toEqual(0);
        });

        it('should connect to a key, connect some times more after first connection is made, and fire all subsequent callbacks immediately with its value', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);

            const callback2 = jest.fn();
            connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback2});

            const callback3 = jest.fn();
            connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback3});

            const callback4 = jest.fn();
            connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback4});

            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
            expect(callback3).toHaveBeenCalledTimes(1);
            expect(callback3).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
            expect(callback4).toHaveBeenCalledTimes(1);
            expect(callback4).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
        });
    });

    describe('withOnyx', () => {
        it('should connect to a key two times with withOnyx and create two connections instead of one', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const connection1 = connectionManager.connect({
                key: ONYXKEYS.TEST_KEY,
                displayName: 'Component1',
                statePropertyName: 'prop1',
                withOnyxInstance: new (class {
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    setStateProxy() {}

                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    setWithOnyxState() {}
                })() as unknown as WithOnyxInstance,
            } as WithOnyxConnectOptions<OnyxKey>);

            const connection2 = connectionManager.connect({
                key: ONYXKEYS.TEST_KEY,
                displayName: 'Component2',
                statePropertyName: 'prop2',
                withOnyxInstance: new (class {
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    setStateProxy() {}

                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    setWithOnyxState() {}
                })() as unknown as WithOnyxInstance,
            } as WithOnyxConnectOptions<OnyxKey>);

            await act(async () => waitForPromisesToResolve());

            expect(connection1.key).not.toEqual(connection2.key);
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection1.key)).toBeTruthy();
            expect(connectionsMap.has(connection2.key)).toBeTruthy();

            connectionManager.disconnect(connection1);
            connectionManager.disconnect(connection2);

            expect(connectionsMap.size).toEqual(0);
        });

        it('should connect to a key directly, connect again with withOnyx and create another connection instead of reusing the first one', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            const connection1 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            await act(async () => waitForPromisesToResolve());

            const connection2 = connectionManager.connect({
                key: ONYXKEYS.TEST_KEY,
                displayName: 'Component2',
                statePropertyName: 'prop2',
                withOnyxInstance: new (class {
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    setStateProxy() {}

                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    setWithOnyxState() {}
                })() as unknown as WithOnyxInstance,
            } as WithOnyxConnectOptions<OnyxKey>);

            expect(connection1.key).not.toEqual(connection2.key);
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection1.key)).toBeTruthy();
            expect(connectionsMap.has(connection2.key)).toBeTruthy();

            connectionManager.disconnect(connection1);
            connectionManager.disconnect(connection2);

            expect(connectionsMap.size).toEqual(0);
        });
    });
});
