/* eslint-disable @lwc/lwc/no-async-await */
/* eslint-disable no-underscore-dangle */
import Onyx from '../../lib';
import DevTools from '../../lib/DevTools';
import utils from '../../lib/utils';

const ONYX_KEYS = {
    NUM_KEY: 'numKey',
    OBJECT_KEY: 'objectKey',
    SOME_KEY: 'someKey',
    COLLECTION: {
        NUM_KEY: 'test_',
        TEST_CONNECT_COLLECTION: 'testConnectCollection_',
        TEST_POLICY: 'testPolicy_',
        TEST_UPDATE: 'testUpdate_',
    },
};

const initialKeyStates = {
    [ONYX_KEYS.NUM_KEY]: 1,
    [ONYX_KEYS.OBJECT_KEY]: {id: 42},
};

const exampleCollection = {
    [`${ONYX_KEYS.COLLECTION.NUM_KEY}1`]: 1,
    [`${ONYX_KEYS.COLLECTION.NUM_KEY}2`]: 2,
};

const exampleObject = {name: 'Pedro'};

const mergedCollection = {...initialKeyStates, ...exampleCollection};

const mergedObject = {...initialKeyStates, [ONYX_KEYS.OBJECT_KEY]: {...exampleObject, id: 42}};

describe('DevTools', () => {
    let initMock;
    let sendMock;

    beforeEach(() => {
        // Mock DevTools
        initMock = jest.fn();
        sendMock = jest.fn();
        DevTools.remoteDev = {init: initMock, send: sendMock};
        Onyx.init({
            keys: ONYX_KEYS,
            registerStorageEventListener: () => {},
            initialKeyStates,
        });
    });
    afterEach(() => {
        Onyx.clear();
    });

    describe('Init', () => {
        it('Sends the initial state correctly to the extension', () => {
            expect(initMock).toHaveBeenCalledWith(initialKeyStates);
        });
        it('Sets the default state correctly', () => {
            expect(DevTools.defaultState).toEqual(initialKeyStates);
        });
        it('Sets the internal state correctly', () => {
            expect(DevTools.state).toEqual(initialKeyStates);
        });
    });

    describe('Set', () => {
        it('Sends the set state correctly to the extension', async () => {
            await Onyx.set(ONYX_KEYS.SOME_KEY, 3);
            expect(sendMock).toHaveBeenCalledWith({payload: 3, type: utils.formatActionName(Onyx.METHOD.SET, ONYX_KEYS.SOME_KEY)}, {...initialKeyStates, [ONYX_KEYS.SOME_KEY]: 3});
        });
        it('Sets the internal state correctly', async () => {
            await Onyx.set(ONYX_KEYS.SOME_KEY, 3);
            expect(DevTools.state).toEqual({...initialKeyStates, [ONYX_KEYS.SOME_KEY]: 3});
        });
    });

    describe('Merge', () => {
        it('Sends the merged state correctly to the extension', async () => {
            await Onyx.merge(ONYX_KEYS.OBJECT_KEY, exampleObject);
            expect(sendMock).toHaveBeenCalledWith({payload: exampleObject, type: utils.formatActionName(Onyx.METHOD.MERGE, ONYX_KEYS.OBJECT_KEY)}, mergedObject);
        });
        it('Sets the internal state correctly', async () => {
            await Onyx.merge(ONYX_KEYS.OBJECT_KEY, exampleObject);
            expect(DevTools.state).toEqual(mergedObject);
        });
    });

    describe('MergeCollection', () => {
        it('Sends the mergecollection state correctly to the extension', async () => {
            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.NUM_KEY, exampleCollection);
            expect(sendMock).toHaveBeenCalledWith({payload: exampleCollection, type: utils.formatActionName(Onyx.METHOD.MERGE_COLLECTION)}, mergedCollection);
        });
        it('Sets the internal state correctly', async () => {
            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.NUM_KEY, exampleCollection);
            expect(DevTools.state).toEqual(mergedCollection);
        });
    });

    describe('MultiSet', () => {
        it('Sends the multiset state correctly to the extension', async () => {
            await Onyx.multiSet(exampleCollection);
            expect(sendMock).toHaveBeenCalledWith({payload: exampleCollection, type: utils.formatActionName(Onyx.METHOD.MULTI_SET)}, mergedCollection);
        });
        it('Sets the internal state correctly', async () => {
            await Onyx.multiSet(exampleCollection);
            expect(DevTools.state).toEqual(mergedCollection);
        });
    });

    describe('Clear', () => {
        it('Sends the clear state correctly to the extension when no keys should be preserved', async () => {
            await Onyx.clear();
            expect(sendMock).toHaveBeenCalledWith({payload: undefined, type: 'CLEAR'}, initialKeyStates);
        });
        it('Sends the clear state correctly to the extension when there are keys that should be preserved', async () => {
            await Onyx.merge(ONYX_KEYS.NUM_KEY, 2);
            await Onyx.clear([ONYX_KEYS.NUM_KEY]);
            expect(sendMock).toHaveBeenCalledWith({payload: undefined, type: 'CLEAR'}, {...initialKeyStates, [ONYX_KEYS.NUM_KEY]: 2});
        });
        it('Clears internal state correctly', async () => {
            await Onyx.merge(ONYX_KEYS.NUM_KEY, 2);
            await Onyx.clear([ONYX_KEYS.NUM_KEY]);
            expect(DevTools.state).toEqual({...initialKeyStates, [ONYX_KEYS.NUM_KEY]: 2});
        });
    });
});
