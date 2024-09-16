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
    describe('splitCollectionMemberKey', () => {
        describe('should return correct values', () => {
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

        it('should throw error if key does not contain underscore', () => {
            expect(() => {
                OnyxUtils.splitCollectionMemberKey(ONYXKEYS.TEST_KEY);
            }).toThrowError("Invalid 'test' key provided, only collection keys are allowed.");
            expect(() => {
                OnyxUtils.splitCollectionMemberKey('');
            }).toThrowError("Invalid '' key provided, only collection keys are allowed.");
        });
    });

    describe('getCollectionKey', () => {
        describe('should return correct values', () => {
            const dataResult: Record<string, string> = {
                test_: 'test_',
                test_level_: 'test_level_',
                test_level_1: 'test_level_',
                test_level_2: 'test_level_',
                test_level_last_3: 'test_level_last_',
                test___FAKE__: 'test_',
                'test_-1_something': 'test_',
                'test_level_-1_something': 'test_level_',
            };

            it.each(Object.keys(dataResult))('%s', (key) => {
                const collectionKey = OnyxUtils.getCollectionKey(key);
                expect(collectionKey).toEqual(dataResult[key]);
            });
        });

        it('should throw error if key does not contain underscore', () => {
            expect(() => {
                OnyxUtils.getCollectionKey(ONYXKEYS.TEST_KEY);
            }).toThrowError("Invalid 'test' key provided, only collection keys are allowed.");
            expect(() => {
                OnyxUtils.getCollectionKey('');
            }).toThrowError("Invalid '' key provided, only collection keys are allowed.");
        });
    });
});
