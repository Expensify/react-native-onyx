// eslint-disable-next-line max-classes-per-file
import {act} from '@testing-library/react-native';
import Onyx from '../../lib';
import connectionManager from '../../lib/OnyxConnectionManager';
import StorageMock from '../../lib/storage';
import type {OnyxKey, WithOnyxConnectOptions} from '../../lib/types';
import type {WithOnyxInstance} from '../../lib/withOnyx/types';
import type GenericCollection from '../utils/GenericCollection';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import OnyxUtils from '../../lib/OnyxUtils';

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

    describe('connect / disconnect', () => {
        it('should connect to a key and fire the callback with its value', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            const connection = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            expect(connectionsMap.has(connection.id)).toBeTruthy();

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

            expect(connection1.id).toEqual(connection2.id);
            expect(connectionsMap.size).toEqual(1);
            expect(connectionsMap.has(connection1.id)).toBeTruthy();

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

            expect(connection1.id).not.toEqual(connection2.id);
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection1.id)).toBeTruthy();
            expect(connectionsMap.has(connection2.id)).toBeTruthy();

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

            await act(async () => waitForPromisesToResolve());

            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
            expect(callback3).toHaveBeenCalledTimes(1);
            expect(callback3).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
            expect(callback4).toHaveBeenCalledTimes(1);
            expect(callback4).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
        });

        it('should have the connection object already defined when triggering the callback of the second connection to the same key', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);

            const callback2 = jest.fn();
            const connection2 = connectionManager.connect({
                key: ONYXKEYS.TEST_KEY,
                callback: (...params) => {
                    callback2(...params);
                    connectionManager.disconnect(connection2);
                },
            });

            await act(async () => waitForPromisesToResolve());

            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
            expect(connectionsMap.size).toEqual(1);
        });

        it('should create a separate connection to the same key when setting reuseConnection to false', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            const connection1 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            const callback2 = jest.fn();
            const connection2 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, reuseConnection: false, callback: callback2});

            expect(connection1.id).not.toEqual(connection2.id);
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection1.id)).toBeTruthy();
            expect(connectionsMap.has(connection2.id)).toBeTruthy();
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

                expect(connection1.id).not.toEqual(connection2.id);
                expect(connectionsMap.size).toEqual(2);
                expect(connectionsMap.has(connection1.id)).toBeTruthy();
                expect(connectionsMap.has(connection2.id)).toBeTruthy();

                connectionManager.disconnect(connection1);
                connectionManager.disconnect(connection2);

                expect(connectionsMap.size).toEqual(0);
            });

            it('should connect to a key directly, connect again with withOnyx but create another connection instead of reusing the first one', async () => {
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

                expect(connection1.id).not.toEqual(connection2.id);
                expect(connectionsMap.size).toEqual(2);
                expect(connectionsMap.has(connection1.id)).toBeTruthy();
                expect(connectionsMap.has(connection2.id)).toBeTruthy();

                connectionManager.disconnect(connection1);
                connectionManager.disconnect(connection2);

                expect(connectionsMap.size).toEqual(0);
            });
        });
    });

    describe('disconnectAll', () => {
        it('should disconnect all connections', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');
            await StorageMock.setItem(ONYXKEYS.TEST_KEY_2, 'test2');

            const callback1 = jest.fn();
            const connection1 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            const callback2 = jest.fn();
            const connection2 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback2});

            const callback3 = jest.fn();
            const connection3 = connectionManager.connect({key: ONYXKEYS.TEST_KEY_2, callback: callback3});

            expect(connection1.id).toEqual(connection2.id);
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection1.id)).toBeTruthy();
            expect(connectionsMap.has(connection3.id)).toBeTruthy();

            await act(async () => waitForPromisesToResolve());

            connectionManager.disconnectAll();

            expect(connectionsMap.size).toEqual(0);
        });
    });

    describe('addToEvictionBlockList / removeFromEvictionBlockList', () => {
        it('should add and remove connections from the eviction block list correctly', async () => {
            const evictionBlocklist = OnyxUtils.getEvictionBlocklist();

            connectionsMap.set('connectionID1', {subscriptionID: 0, onyxKey: ONYXKEYS.TEST_KEY, callbacks: new Map(), isConnectionMade: true});
            connectionsMap.get('connectionID1')?.callbacks.set('callbackID1', () => undefined);
            connectionManager.addToEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID1', subscriptionID: 0});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toEqual(['connectionID1_callbackID1']);

            connectionsMap.get('connectionID1')?.callbacks.set('callbackID2', () => undefined);
            connectionManager.addToEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID2', subscriptionID: 0});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toEqual(['connectionID1_callbackID1', 'connectionID1_callbackID2']);

            connectionsMap.set('connectionID2', {subscriptionID: 1, onyxKey: `${ONYXKEYS.COLLECTION.TEST_KEY}entry1`, callbacks: new Map(), isConnectionMade: true});
            connectionsMap.get('connectionID2')?.callbacks.set('callbackID3', () => undefined);
            connectionManager.addToEvictionBlockList({id: 'connectionID2', callbackID: 'callbackID3', subscriptionID: 1});
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]).toEqual(['connectionID2_callbackID3']);

            connectionManager.removeFromEvictionBlockList({id: 'connectionID2', callbackID: 'callbackID3', subscriptionID: 1});
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]).toBeUndefined();

            // inexistent callback ID, shouldn't do anything
            connectionManager.removeFromEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID1000', subscriptionID: 0});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toEqual(['connectionID1_callbackID1', 'connectionID1_callbackID2']);

            connectionManager.removeFromEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID2', subscriptionID: 0});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toEqual(['connectionID1_callbackID1']);

            connectionManager.removeFromEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID1', subscriptionID: 0});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toBeUndefined();

            // inexistent connection ID, shouldn't do anything
            expect(() => connectionManager.removeFromEvictionBlockList({id: 'connectionID0', callbackID: 'callbackID0', subscriptionID: 0})).not.toThrow();
        });
    });
});
