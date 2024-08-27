// eslint-disable-next-line max-classes-per-file
import {act} from '@testing-library/react-native';
import Onyx from '../../lib';
import type {Connection} from '../../lib/OnyxConnectionManager';
import connectionManager from '../../lib/OnyxConnectionManager';
import OnyxUtils from '../../lib/OnyxUtils';
import StorageMock from '../../lib/storage';
import type {OnyxKey, WithOnyxConnectOptions} from '../../lib/types';
import type {WithOnyxInstance} from '../../lib/withOnyx/types';
import type GenericCollection from '../utils/GenericCollection';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

// We need access to `connectionsMap` and `generateConnectionID` during the tests but the properties are private,
// so this workaround allows us to have access to them.
// eslint-disable-next-line dot-notation
const connectionsMap = connectionManager['connectionsMap'];
// eslint-disable-next-line dot-notation
const generateConnectionID = connectionManager['generateConnectionID'];

function generateEmptyWithOnyxInstance() {
    return new (class {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setStateProxy() {}

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setWithOnyxState() {}
    })() as unknown as WithOnyxInstance;
}

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

    describe('generateConnectionID', () => {
        it('should generate a stable connection ID', async () => {
            const connectionID = generateConnectionID({key: ONYXKEYS.TEST_KEY});
            expect(connectionID).toEqual(`onyxKey=${ONYXKEYS.TEST_KEY},initWithStoredValues=true,waitForCollectionCallback=false`);
        });

        it("should generate a stable connection ID regardless of the order which the option's properties were passed", async () => {
            const connectionID = generateConnectionID({key: ONYXKEYS.TEST_KEY, waitForCollectionCallback: true, initWithStoredValues: true});
            expect(connectionID).toEqual(`onyxKey=${ONYXKEYS.TEST_KEY},initWithStoredValues=true,waitForCollectionCallback=true`);
        });

        it('should generate unique connection IDs if certain options are passed', async () => {
            const connectionID1 = generateConnectionID({key: ONYXKEYS.TEST_KEY, reuseConnection: false});
            const connectionID2 = generateConnectionID({key: ONYXKEYS.TEST_KEY, reuseConnection: false});
            expect(connectionID1.startsWith(`onyxKey=${ONYXKEYS.TEST_KEY},initWithStoredValues=true,waitForCollectionCallback=false,uniqueID=`)).toBeTruthy();
            expect(connectionID2.startsWith(`onyxKey=${ONYXKEYS.TEST_KEY},initWithStoredValues=true,waitForCollectionCallback=false,uniqueID=`)).toBeTruthy();
            expect(connectionID1).not.toEqual(connectionID2);

            const connectionID3 = generateConnectionID({key: ONYXKEYS.TEST_KEY, initWithStoredValues: false});
            expect(connectionID3.startsWith(`onyxKey=${ONYXKEYS.TEST_KEY},initWithStoredValues=false,waitForCollectionCallback=false,uniqueID=`)).toBeTruthy();

            const connectionID4 = generateConnectionID({
                key: ONYXKEYS.TEST_KEY,
                displayName: 'Component1',
                statePropertyName: 'prop1',
                withOnyxInstance: generateEmptyWithOnyxInstance(),
            } as WithOnyxConnectOptions<OnyxKey>);
            expect(connectionID4.startsWith(`onyxKey=${ONYXKEYS.TEST_KEY},initWithStoredValues=true,waitForCollectionCallback=false,uniqueID=`)).toBeTruthy();
        });
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

        it('should create a separate connection to the same key when setting initWithStoredValues to false', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            const connection1 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, initWithStoredValues: false, callback: callback1});

            await act(async () => waitForPromisesToResolve());

            expect(callback1).not.toHaveBeenCalled();
            expect(connectionsMap.size).toEqual(1);
            expect(connectionsMap.has(connection1.id)).toBeTruthy();

            await Onyx.set(ONYXKEYS.TEST_KEY, 'test2');

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test2', ONYXKEYS.TEST_KEY);

            const callback2 = jest.fn();
            const connection2 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, initWithStoredValues: false, callback: callback2});

            await act(async () => waitForPromisesToResolve());

            expect(callback2).not.toHaveBeenCalled();
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection2.id)).toBeTruthy();

            await Onyx.set(ONYXKEYS.TEST_KEY, 'test3');

            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith('test3', ONYXKEYS.TEST_KEY);

            connectionManager.disconnect(connection1);
            connectionManager.disconnect(connection2);

            expect(connectionsMap.size).toEqual(0);
        });

        it('should not throw any errors when passing an undefined connection or trying to access an inexistent one inside disconnect()', () => {
            expect(connectionsMap.size).toEqual(0);

            expect(() => {
                connectionManager.disconnect(undefined as unknown as Connection);
            }).not.toThrow();

            expect(() => {
                connectionManager.disconnect({id: 'connectionID1', callbackID: 'callbackID1'});
            }).not.toThrow();
        });

        describe('withOnyx', () => {
            it('should connect to a key two times with withOnyx and create two connections instead of one', async () => {
                await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

                const connection1 = connectionManager.connect({
                    key: ONYXKEYS.TEST_KEY,
                    displayName: 'Component1',
                    statePropertyName: 'prop1',
                    withOnyxInstance: generateEmptyWithOnyxInstance(),
                } as WithOnyxConnectOptions<OnyxKey>);

                const connection2 = connectionManager.connect({
                    key: ONYXKEYS.TEST_KEY,
                    displayName: 'Component2',
                    statePropertyName: 'prop2',
                    withOnyxInstance: generateEmptyWithOnyxInstance(),
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
                    withOnyxInstance: generateEmptyWithOnyxInstance(),
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
            connectionManager.addToEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID1'});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toEqual(['connectionID1_callbackID1']);

            connectionsMap.get('connectionID1')?.callbacks.set('callbackID2', () => undefined);
            connectionManager.addToEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID2'});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toEqual(['connectionID1_callbackID1', 'connectionID1_callbackID2']);

            connectionsMap.set('connectionID2', {subscriptionID: 1, onyxKey: `${ONYXKEYS.COLLECTION.TEST_KEY}entry1`, callbacks: new Map(), isConnectionMade: true});
            connectionsMap.get('connectionID2')?.callbacks.set('callbackID3', () => undefined);
            connectionManager.addToEvictionBlockList({id: 'connectionID2', callbackID: 'callbackID3'});
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]).toEqual(['connectionID2_callbackID3']);

            connectionManager.removeFromEvictionBlockList({id: 'connectionID2', callbackID: 'callbackID3'});
            expect(evictionBlocklist[`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]).toBeUndefined();

            // inexistent callback ID, shouldn't do anything
            connectionManager.removeFromEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID1000'});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toEqual(['connectionID1_callbackID1', 'connectionID1_callbackID2']);

            connectionManager.removeFromEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID2'});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toEqual(['connectionID1_callbackID1']);

            connectionManager.removeFromEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID1'});
            expect(evictionBlocklist[ONYXKEYS.TEST_KEY]).toBeUndefined();

            // inexistent connection ID, shouldn't do anything
            expect(() => connectionManager.removeFromEvictionBlockList({id: 'connectionID0', callbackID: 'callbackID0'})).not.toThrow();
        });

        it('should not throw any errors when passing an undefined connection or trying to access an inexistent one inside addToEvictionBlockList()', () => {
            expect(connectionsMap.size).toEqual(0);

            expect(() => {
                connectionManager.addToEvictionBlockList(undefined as unknown as Connection);
            }).not.toThrow();

            expect(() => {
                connectionManager.addToEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID1'});
            }).not.toThrow();
        });

        it('should not throw any errors when passing an undefined connection or trying to access an inexistent one inside removeFromEvictionBlockList()', () => {
            expect(connectionsMap.size).toEqual(0);

            expect(() => {
                connectionManager.removeFromEvictionBlockList(undefined as unknown as Connection);
            }).not.toThrow();

            expect(() => {
                connectionManager.removeFromEvictionBlockList({id: 'connectionID1', callbackID: 'callbackID1'});
            }).not.toThrow();
        });
    });
});
