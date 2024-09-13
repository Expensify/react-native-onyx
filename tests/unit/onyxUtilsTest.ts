import Onyx from '../../lib';
import OnyxUtils from '../../lib/OnyxUtils';

const ONYXKEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_LEVEL_KEY: 'test_level_',
        TEST_LEVEL_LAST_KEY: 'test_level_last_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());

describe('OnyxUtils', () => {
    describe('splitCollectionMemberKey should return correct values', () => {
        const dataResult: Record<string, [string, string]> = {
            test_: ['test_', ''],
            test_level_: ['test_level_', ''],
            test_level_1: ['test_level_', '1'],
            test_level_2: ['test_level_', '2'],
            test_level_last_3: ['test_level_last_', '3'],
            test___FAKE__: ['test_', '__FAKE__'],
            'test_-1_something': ['test_', '-1_something'],
            'test_level_-1_something': ['test_level_', '-1_something'],
        };

        it.each(Object.keys(dataResult))('%s', (key) => {
            const [collectionKey, id] = OnyxUtils.splitCollectionMemberKey(key);
            expect(collectionKey).toEqual(dataResult[key][0]);
            expect(id).toEqual(dataResult[key][1]);
        });
    });

    it('splitCollectionMemberKey should throw error if key does not contain underscore', () => {
        expect(() => {
            OnyxUtils.splitCollectionMemberKey('test');
        }).toThrowError("Invalid 'test' key provided, only collection keys are allowed.");
        expect(() => {
            OnyxUtils.splitCollectionMemberKey('');
        }).toThrowError("Invalid '' key provided, only collection keys are allowed.");
    });

    it('getCollectionKey should return correct values', () => {
        const dataResult: Record<string, string> = {
            test: 'test',
            test_: 'test_',
            test_level_: 'test_level_',
            test_level_1: 'test_level_',
            test_level_2: 'test_level_',
            test_level_last_3: 'test_level_last_',
        };

        Object.keys(dataResult).forEach((key) => {
            const collectionKey = OnyxUtils.getCollectionKey(key);
            expect(collectionKey).toEqual(dataResult[key]);
        });
    });
});
