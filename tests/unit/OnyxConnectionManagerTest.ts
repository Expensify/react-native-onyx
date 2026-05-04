import {act} from '@testing-library/react-native';
import Onyx from '../../lib';
import type {Connection} from '../../lib/OnyxConnectionManager';
import connectionManager from '../../lib/OnyxConnectionManager';
import StorageMock from '../../lib/storage';
import type GenericCollection from '../utils/GenericCollection';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

// We need access to some internal properties of `connectionManager` during the tests but they are private,
// so this workaround allows us to have access to them.
// eslint-disable-next-line dot-notation
const connectionsMap = connectionManager['connectionsMap'];
// eslint-disable-next-line dot-notation
const generateConnectionID = connectionManager['generateConnectionID'];
// eslint-disable-next-line dot-notation
const getSessionID = () => connectionManager['sessionID'];

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
            expect(connectionID).toEqual(`onyxKey=${ONYXKEYS.TEST_KEY},waitForCollectionCallback=false,sessionID=${getSessionID()}`);
        });

        it("should generate a stable connection ID regardless of the order which the option's properties were passed", async () => {
            const connectionID = generateConnectionID({key: ONYXKEYS.TEST_KEY, waitForCollectionCallback: true});
            expect(connectionID).toEqual(`onyxKey=${ONYXKEYS.TEST_KEY},waitForCollectionCallback=true,sessionID=${getSessionID()}`);
        });

        it('should generate unique connection IDs if certain options are passed', async () => {
            const connectionID1 = generateConnectionID({key: ONYXKEYS.TEST_KEY, reuseConnection: false});
            const connectionID2 = generateConnectionID({key: ONYXKEYS.TEST_KEY, reuseConnection: false});
            expect(connectionID1.startsWith(`onyxKey=${ONYXKEYS.TEST_KEY},waitForCollectionCallback=false,sessionID=${getSessionID()},uniqueID=`)).toBeTruthy();
            expect(connectionID2.startsWith(`onyxKey=${ONYXKEYS.TEST_KEY},waitForCollectionCallback=false,sessionID=${getSessionID()},uniqueID=`)).toBeTruthy();
            expect(connectionID1).not.toEqual(connectionID2);
        });

        it('should generate an unique connection ID if the session ID is changed', async () => {
            const connectionID1 = generateConnectionID({key: ONYXKEYS.TEST_KEY});
            connectionManager.refreshSessionID();
            const connectionID2 = generateConnectionID({key: ONYXKEYS.TEST_KEY});

            expect(connectionID1).not.toEqual(connectionID2);
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
            const collection = {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: obj1,
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: obj2,
            } as GenericCollection;
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
            expect(callback2).toHaveBeenCalledWith(collection, ONYXKEYS.COLLECTION.TEST_KEY, undefined);

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

        it("should create a separate connection to the same key when it's a collection one and waitForCollectionCallback is undefined/false", async () => {
            const collection = {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`]: {id: 'entry3_id', name: 'entry3_name'},
            };

            Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, collection as GenericCollection);

            await act(async () => waitForPromisesToResolve());

            const callback1 = jest.fn();
            const connection1 = connectionManager.connect({key: ONYXKEYS.COLLECTION.TEST_KEY, waitForCollectionCallback: undefined, callback: callback1});

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(3);
            expect(callback1).toHaveBeenNthCalledWith(1, collection[`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`], `${ONYXKEYS.COLLECTION.TEST_KEY}entry1`);
            expect(callback1).toHaveBeenNthCalledWith(2, collection[`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`], `${ONYXKEYS.COLLECTION.TEST_KEY}entry2`);
            expect(callback1).toHaveBeenNthCalledWith(3, collection[`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`], `${ONYXKEYS.COLLECTION.TEST_KEY}entry3`);

            const callback2 = jest.fn();
            const connection2 = connectionManager.connect({key: ONYXKEYS.COLLECTION.TEST_KEY, waitForCollectionCallback: false, callback: callback2});

            expect(connection1.id).not.toEqual(connection2.id);
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection1.id)).toBeTruthy();
            expect(connectionsMap.has(connection2.id)).toBeTruthy();

            await act(async () => waitForPromisesToResolve());

            expect(callback2).toHaveBeenCalledTimes(3);
            expect(callback2).toHaveBeenNthCalledWith(1, collection[`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`], `${ONYXKEYS.COLLECTION.TEST_KEY}entry1`);
            expect(callback2).toHaveBeenNthCalledWith(2, collection[`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`], `${ONYXKEYS.COLLECTION.TEST_KEY}entry2`);
            expect(callback2).toHaveBeenNthCalledWith(3, collection[`${ONYXKEYS.COLLECTION.TEST_KEY}entry3`], `${ONYXKEYS.COLLECTION.TEST_KEY}entry3`);
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

        it('should create a separate connection for the same key after a Onyx.clear() call', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});
            expect(connectionsMap.size).toEqual(1);

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
            callback1.mockReset();

            await act(async () => Onyx.clear());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith(undefined, ONYXKEYS.TEST_KEY);
            callback1.mockReset();

            const callback2 = jest.fn();
            connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback2});

            const callback3 = jest.fn();
            connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback3});

            // We expect to have two connections for ONYXKEYS.TEST_KEY, one for the first subscription before Onyx.clear(),
            // and the other for the two subscriptions with the same key after Onyx.clear().
            expect(connectionsMap.size).toEqual(2);

            await act(async () => waitForPromisesToResolve());

            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith(undefined, undefined);
            expect(callback3).toHaveBeenCalledTimes(1);
            expect(callback3).toHaveBeenCalledWith(undefined, undefined);
            callback1.mockReset();
            callback2.mockReset();
            callback3.mockReset();

            Onyx.merge(ONYXKEYS.TEST_KEY, 'test2');
            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test2', ONYXKEYS.TEST_KEY);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith('test2', ONYXKEYS.TEST_KEY);
            expect(callback3).toHaveBeenCalledTimes(1);
            expect(callback3).toHaveBeenCalledWith('test2', ONYXKEYS.TEST_KEY);
        });
    });

    describe('unsubscribeFromKey', () => {
        it('should clean up the correct subscription ID from lastConnectionCallbackData on disconnect', async () => {
            const deleteSpy = jest.spyOn(Map.prototype, 'delete');

            const connectionA = Onyx.connect({key: ONYXKEYS.TEST_KEY, callback: jest.fn(), reuseConnection: false});
            Onyx.connect({key: ONYXKEYS.TEST_KEY, callback: jest.fn(), reuseConnection: false});
            await act(async () => waitForPromisesToResolve());

            const subscriptionIdA = connectionsMap.get(connectionA.id)?.subscriptionID;

            await Onyx.set(ONYXKEYS.TEST_KEY, 'value1');
            await act(async () => waitForPromisesToResolve());

            deleteSpy.mockClear();
            Onyx.disconnect(connectionA);

            const numericDeleteArgs = deleteSpy.mock.calls.map((call) => call[0]).filter((arg): arg is number => typeof arg === 'number');
            expect(numericDeleteArgs).toContain(subscriptionIdA);

            deleteSpy.mockRestore();
        });

        it('should remove the subscription ID from onyxKeyToSubscriptionIDs on disconnect', async () => {
            const setSpy = jest.spyOn(Map.prototype, 'set');

            const connectionA = Onyx.connect({key: ONYXKEYS.TEST_KEY, callback: jest.fn(), reuseConnection: false});
            const connectionB = Onyx.connect({key: ONYXKEYS.TEST_KEY, callback: jest.fn(), reuseConnection: false});
            await act(async () => waitForPromisesToResolve());

            const subscriptionIdA = connectionsMap.get(connectionA.id)?.subscriptionID;
            const subscriptionIdB = connectionsMap.get(connectionB.id)?.subscriptionID;

            setSpy.mockClear();
            Onyx.disconnect(connectionA);

            const setCallsForKey = setSpy.mock.calls.filter((call) => call[0] === ONYXKEYS.TEST_KEY);
            expect(setCallsForKey.length).toBeGreaterThan(0);

            const updatedIDs = setCallsForKey[setCallsForKey.length - 1][1] as number[];
            expect(updatedIDs).not.toContain(subscriptionIdA);
            expect(updatedIDs).toContain(subscriptionIdB);

            setSpy.mockRestore();
            Onyx.disconnect(connectionB);
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

    describe('refreshSessionID', () => {
        it('should create a separate connection for the same key if the session ID changes', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');
            await StorageMock.setItem(ONYXKEYS.TEST_KEY_2, 'test2');

            const connection1 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: jest.fn()});

            expect(connectionsMap.size).toEqual(1);

            connectionManager.refreshSessionID();

            const connection2 = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: jest.fn()});

            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(connection1.id)).toBeTruthy();
            expect(connectionsMap.has(connection2.id)).toBeTruthy();
        });
    });

    describe('sourceValue parameter', () => {
        it('should pass the sourceValue parameter to collection callbacks when waitForCollectionCallback is true', async () => {
            const obj1 = {id: 'entry1_id', name: 'entry1_name'};
            const obj2 = {id: 'entry2_id', name: 'entry2_name'};

            const callback = jest.fn();
            const connection = connectionManager.connect({
                key: ONYXKEYS.COLLECTION.TEST_KEY,
                callback,
                waitForCollectionCallback: true,
            });

            await act(async () => waitForPromisesToResolve());

            // Initial callback with undefined values
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(undefined, ONYXKEYS.COLLECTION.TEST_KEY, undefined);

            // Reset mock to test the next update
            callback.mockReset();

            // Update with first object
            await Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`, obj1);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith({[`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: obj1}, ONYXKEYS.COLLECTION.TEST_KEY, {[`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: obj1});

            // Reset mock to test the next update
            callback.mockReset();

            // Update with second object
            await Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`, obj2);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(
                {
                    [`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`]: obj1,
                    [`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: obj2,
                },
                ONYXKEYS.COLLECTION.TEST_KEY,
                {[`${ONYXKEYS.COLLECTION.TEST_KEY}entry2`]: obj2},
            );

            connectionManager.disconnect(connection);
        });

        it('should not pass sourceValue to regular callbacks when waitForCollectionCallback is false', async () => {
            const obj1 = {id: 'entry1_id', name: 'entry1_name'};

            const callback = jest.fn();
            const connection = connectionManager.connect({
                key: ONYXKEYS.COLLECTION.TEST_KEY,
                callback,
                waitForCollectionCallback: false,
            });

            await act(async () => waitForPromisesToResolve());

            // Update with object
            await Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`, obj1);

            expect(callback).toHaveBeenCalledWith(obj1, `${ONYXKEYS.COLLECTION.TEST_KEY}entry1`);

            connectionManager.disconnect(connection);
        });
    });
});
