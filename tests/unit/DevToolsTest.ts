/* eslint-disable dot-notation */
/* eslint-disable @lwc/lwc/no-async-await */
/* eslint-disable no-underscore-dangle */
import Onyx from '../../lib';
import {getDevToolsInstance} from '../../lib/DevTools';
import type {DevtoolsConnection, RealDevTools as RealDevToolsType} from '../../lib/DevTools';
import RealDevTools from '../../lib/DevTools/RealDevTools';
import utils from '../../lib/utils';
import type GenericCollection from '../utils/GenericCollection';

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

const exampleCollection: GenericCollection = {
    [`${ONYX_KEYS.COLLECTION.NUM_KEY}1`]: 1,
    [`${ONYX_KEYS.COLLECTION.NUM_KEY}2`]: 2,
};

const exampleObject = {name: 'Pedro'};

const mergedCollection = {...initialKeyStates, ...exampleCollection};

const mergedObject = {...initialKeyStates, [ONYX_KEYS.OBJECT_KEY]: {...exampleObject, id: 42}};

describe('DevTools', () => {
    let initMock: jest.Mock<void>;
    let sendMock: jest.Mock<void>;

    beforeEach(() => {
        // Mock DevTools - need to mock the connectViaExtension method BEFORE Onyx.init() is called
        initMock = jest.fn();
        sendMock = jest.fn();

        // Mock the connectViaExtension method to return our mock connection
        // This needs to happen before RealDevTools is instantiated
        const mockConnection = {init: initMock, send: sendMock} as unknown as DevtoolsConnection;
        jest.spyOn(RealDevTools.prototype, 'connectViaExtension').mockReturnValue(mockConnection);

        Onyx.init({
            keys: ONYX_KEYS,
            initialKeyStates,
            enableDevTools: true, // Enable DevTools for testing
        });
    });
    afterEach(() => {
        Onyx.clear();
        jest.restoreAllMocks();
    });

    describe('Init', () => {
        it('Sends the initial state correctly to the extension', () => {
            expect(initMock).toHaveBeenCalledWith(initialKeyStates);
        });
        it('Sets the default state correctly', () => {
            const devToolsInstance = getDevToolsInstance() as RealDevToolsType;
            expect(devToolsInstance['defaultState']).toEqual(initialKeyStates);
        });
        it('Sets the internal state correctly', () => {
            const devToolsInstance = getDevToolsInstance() as RealDevToolsType;
            expect(devToolsInstance['state']).toEqual(initialKeyStates);
        });
    });

    describe('Set', () => {
        it('Sends the set state correctly to the extension', async () => {
            await Onyx.set(ONYX_KEYS.SOME_KEY, 3);
            expect(sendMock).toHaveBeenCalledWith({payload: 3, type: utils.formatActionName(Onyx.METHOD.SET, ONYX_KEYS.SOME_KEY)}, {...initialKeyStates, [ONYX_KEYS.SOME_KEY]: 3});
        });
        it('Sets the internal state correctly', async () => {
            await Onyx.set(ONYX_KEYS.SOME_KEY, 3);
            const devToolsInstance = getDevToolsInstance() as RealDevToolsType;
            expect(devToolsInstance['state']).toEqual({...initialKeyStates, [ONYX_KEYS.SOME_KEY]: 3});
        });
    });

    describe('Merge', () => {
        it('Sends the merged state correctly to the extension', async () => {
            await Onyx.merge(ONYX_KEYS.OBJECT_KEY, exampleObject);
            expect(sendMock).toHaveBeenCalledWith({payload: exampleObject, type: utils.formatActionName(Onyx.METHOD.MERGE, ONYX_KEYS.OBJECT_KEY)}, mergedObject);
        });
        it('Sets the internal state correctly', async () => {
            await Onyx.merge(ONYX_KEYS.OBJECT_KEY, exampleObject);
            const devToolsInstance = getDevToolsInstance() as RealDevToolsType;
            expect(devToolsInstance['state']).toEqual(mergedObject);
        });
    });

    describe('MergeCollection', () => {
        it('Sends the mergecollection state correctly to the extension', async () => {
            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.NUM_KEY, exampleCollection);
            expect(sendMock).toHaveBeenCalledWith({payload: exampleCollection, type: utils.formatActionName(Onyx.METHOD.MERGE_COLLECTION)}, mergedCollection);
        });
        it('Sets the internal state correctly', async () => {
            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.NUM_KEY, exampleCollection);
            const devToolsInstance = getDevToolsInstance() as RealDevToolsType;
            expect(devToolsInstance['state']).toEqual(mergedCollection);
        });
    });

    describe('MultiSet', () => {
        it('Sends the multiset state correctly to the extension', async () => {
            await Onyx.multiSet(exampleCollection);
            expect(sendMock).toHaveBeenCalledWith({payload: exampleCollection, type: utils.formatActionName(Onyx.METHOD.MULTI_SET)}, mergedCollection);
        });
        it('Sets the internal state correctly', async () => {
            await Onyx.multiSet(exampleCollection);
            const devToolsInstance = getDevToolsInstance() as RealDevToolsType;
            expect(devToolsInstance['state']).toEqual(mergedCollection);
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
            const devToolsInstance = getDevToolsInstance() as RealDevToolsType;
            expect(devToolsInstance['state']).toEqual({...initialKeyStates, [ONYX_KEYS.NUM_KEY]: 2});
        });
    });
});
