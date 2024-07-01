import {act} from '@testing-library/react-native';
import Onyx from '../../lib';
import connectionManager from '../../lib/OnyxConnectionManager';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';
import type GenericCollection from '../utils/GenericCollection';

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
            const [, mapKey, callbackID] = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            expect(connectionsMap.has(mapKey)).toBeTruthy();

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);

            connectionManager.disconnect(mapKey, callbackID);

            expect(connectionsMap.size).toEqual(0);
        });

        it('should connect two times to the same key and fire both callbacks with its value', async () => {
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'test');

            const callback1 = jest.fn();
            const [, mapKey1, callbackID1] = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback1});

            const callback2 = jest.fn();
            const [, mapKey2, callbackID2] = connectionManager.connect({key: ONYXKEYS.TEST_KEY, callback: callback2});

            expect(mapKey1).toEqual(mapKey2);
            expect(connectionsMap.size).toEqual(1);
            expect(connectionsMap.has(mapKey1)).toBeTruthy();

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith('test', ONYXKEYS.TEST_KEY);

            connectionManager.disconnect(mapKey1, callbackID1);
            connectionManager.disconnect(mapKey1, callbackID2);

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
            const [, mapKey1, callbackID1] = connectionManager.connect({key: ONYXKEYS.COLLECTION.TEST_KEY, callback: callback1});

            const callback2 = jest.fn();
            const [, mapKey2, callbackID2] = connectionManager.connect({key: ONYXKEYS.COLLECTION.TEST_KEY, callback: callback2, waitForCollectionCallback: true});

            expect(mapKey1).not.toEqual(mapKey2);
            expect(connectionsMap.size).toEqual(2);
            expect(connectionsMap.has(mapKey1)).toBeTruthy();
            expect(connectionsMap.has(mapKey2)).toBeTruthy();

            await act(async () => waitForPromisesToResolve());

            expect(callback1).toHaveBeenCalledTimes(2);
            expect(callback1).toHaveBeenNthCalledWith(1, obj1, `${ONYXKEYS.COLLECTION.TEST_KEY}entry1`);
            expect(callback1).toHaveBeenNthCalledWith(2, obj2, `${ONYXKEYS.COLLECTION.TEST_KEY}entry2`);

            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith(collection, undefined);

            connectionManager.disconnect(mapKey1, callbackID1);
            connectionManager.disconnect(mapKey2, callbackID2);

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
});
