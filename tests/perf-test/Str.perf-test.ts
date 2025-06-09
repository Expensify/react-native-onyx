import {measureFunction} from 'reassure';
import * as Str from '../../lib/Str';

const ONYXKEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

describe('Str', () => {
    describe('guid', () => {
        test('one call', async () => {
            await measureFunction(() => Str.guid());
        });
    });

    describe('result', () => {
        test('one call with string parameter', async () => {
            await measureFunction(() => Str.result('key'));
        });

        test('one call with function parameter and args', async () => {
            await measureFunction(() => Str.result((collectionKey, id) => `${collectionKey}${id}`, ONYXKEYS.COLLECTION.TEST_KEY, 'entry1'));
        });
    });

    describe('startsWith', () => {
        test('one call', async () => {
            await measureFunction(() => Str.startsWith(`${ONYXKEYS.COLLECTION.TEST_KEY}entry1`, ONYXKEYS.COLLECTION.TEST_KEY));
        });
    });
});
