/** Integration coverage for native Onyx.merge using NitroSQLite's Node mock. */
import type * as NitroSQLiteMock from 'react-native-nitro-sqlite/mock';
import Onyx from '../../lib';
import type {Connection} from '../../lib/Onyx';
import Storage from '../../lib/storage';
import SQLiteProvider from '../../lib/storage/providers/SQLiteProvider';

jest.unmock('../../lib/storage');
jest.mock('../../lib/storage/platforms', () => jest.requireActual('../../lib/storage/platforms/index.native'));
// Override the web implementation selected by the shared Jest configuration for this suite only.
jest.mock('../../lib/OnyxMerge', () => jest.requireActual('../../lib/OnyxMerge/index.native'));
jest.mock('react-native-nitro-sqlite', () => jest.requireActual('react-native-nitro-sqlite/mock'));

const {resetAllDatabases} = jest.requireActual<typeof NitroSQLiteMock>('react-native-nitro-sqlite/mock');

const ONYXKEYS = {
    TEST_KEY: 'test',
    RAM_ONLY_KEY: 'ramOnlyKey',
};

describe('Native OnyxMerge with SQLite storage', () => {
    let connection: Connection | undefined;

    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            ramOnlyKeys: [ONYXKEYS.RAM_ONLY_KEY],
            shouldSyncMultipleInstances: false,
            enableDevTools: false,
        });
        expect(Storage.getStorageProvider()).toBe(SQLiteProvider);
    });

    beforeEach(async () => {
        await Onyx.clear();
    });

    afterEach(() => {
        connection?.unsubscribe();
        connection = undefined;
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await Onyx.clear();
        resetAllDatabases();
    });

    it.each([
        {
            name: 'remove top-level and nested null properties from an existing value',
            initialValue: {keep: true, remove: true, nested: {keep: true, remove: true}},
            changes: [{remove: null, nested: {remove: null}}, {nested: {added: 'value'}}],
            expected: {keep: true, nested: {keep: true, added: 'value'}},
        },
        {
            name: 'remove nested null properties when inserting a new value',
            initialValue: undefined,
            changes: [{remove: null, nested: {keep: true, remove: null}}, {nested: {added: 'value'}}],
            expected: {nested: {keep: true, added: 'value'}},
        },
        {
            name: 'discard the existing value after a top-level null in a batch',
            initialValue: {old: true, nested: {old: true}},
            changes: [{ignored: true}, null, {added: true, nested: {keep: true, remove: true}}, {nested: {remove: null}}],
            expected: {added: true, nested: {keep: true}},
        },
        {
            name: 'replace a nested object after null without retaining its old properties',
            initialValue: {keep: true, nested: {old: true, deeper: {old: true}}},
            changes: [{nested: null}, {nested: {deeper: {added: true}}}],
            expected: {keep: true, nested: {deeper: {added: true}}},
        },
        {
            name: 'replace arrays while merging adjacent objects',
            initialValue: {items: ['old'], nested: {keep: true}},
            changes: [{items: ['first'], nested: {added: true}}, {items: ['last']}],
            expected: {items: ['last'], nested: {keep: true, added: true}},
        },
    ])('should $name', async ({initialValue, changes, expected}) => {
        if (initialValue !== undefined) {
            await Onyx.set(ONYXKEYS.TEST_KEY, initialValue);
        }

        let subscriberValue: unknown;
        connection = Onyx.connect({
            key: ONYXKEYS.TEST_KEY,
            callback: (value) => {
                subscriberValue = value;
            },
        });
        await Promise.all(changes.map((change) => Onyx.merge(ONYXKEYS.TEST_KEY, change)));

        expect(subscriberValue).toEqual(expected);
        expect(await Onyx.get(ONYXKEYS.TEST_KEY)).toEqual(expected);
        expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual(expected);
    });

    it('should batch changes into one SQLite delta merge for an existing value', async () => {
        await Onyx.set(ONYXKEYS.TEST_KEY, {keep: true});
        const mergeItem = jest.spyOn(SQLiteProvider, 'mergeItem');

        await Promise.all([Onyx.merge(ONYXKEYS.TEST_KEY, {first: true}), Onyx.merge(ONYXKEYS.TEST_KEY, {second: true})]);

        expect(mergeItem).toHaveBeenCalledTimes(1);
        expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual({keep: true, first: true, second: true});
    });

    it('should skip persistence when the merged value is unchanged', async () => {
        const value = {nested: {keep: true}};
        await Onyx.set(ONYXKEYS.TEST_KEY, value);
        const mergeItem = jest.spyOn(SQLiteProvider, 'mergeItem');

        await Onyx.merge(ONYXKEYS.TEST_KEY, value);

        expect(mergeItem).not.toHaveBeenCalled();
        expect(await Onyx.get(ONYXKEYS.TEST_KEY)).toEqual(value);
        expect(await SQLiteProvider.getItem(ONYXKEYS.TEST_KEY)).toEqual(value);
    });

    it('should keep RAM-only merges out of SQLite', async () => {
        const value = {nested: {keep: true}};
        const mergeItem = jest.spyOn(SQLiteProvider, 'mergeItem');

        await Onyx.merge(ONYXKEYS.RAM_ONLY_KEY, value);

        expect(mergeItem).not.toHaveBeenCalled();
        expect(await Onyx.get(ONYXKEYS.RAM_ONLY_KEY)).toEqual(value);
        expect(await SQLiteProvider.getItem(ONYXKEYS.RAM_ONLY_KEY)).toBeNull();
    });
});
