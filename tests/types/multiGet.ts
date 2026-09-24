import Onyx from '../../dist/Onyx';
import ONYX_KEYS from './setup';

async function readsArePositional() {
    const [single, collection] = await Onyx.multiGet([ONYX_KEYS.TEST_KEY, ONYX_KEYS.COLLECTION.TEST_KEY]);

    if (!collection) {
        return single;
    }

    collection.test_1 = {str: 'mutated'};

    return single;
}

async function mixedKeysKeepTheirOwnTypes() {
    const [single, member] = await Onyx.multiGet([ONYX_KEYS.TEST_KEY, `${ONYX_KEYS.COLLECTION.TEST_KEY}1`]);

    if (!member) {
        return single;
    }

    member.str = 'mutated';
    member.list?.push('appended');

    return [single, member] as const;
}

async function singleKeyListResolvesToTuple() {
    const [single] = await Onyx.multiGet([ONYX_KEYS.TEST_KEY]);

    return single;
}

async function writeBackWhatWasRead() {
    const [single, member] = await Onyx.multiGet([ONYX_KEYS.TEST_KEY, `${ONYX_KEYS.COLLECTION.TEST_KEY}1`]);

    await Onyx.set(ONYX_KEYS.TEST_KEY, single ?? null);

    if (!member) {
        return;
    }

    await Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, member);
    await Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, member);
}

export {readsArePositional, mixedKeysKeepTheirOwnTypes, singleKeyListResolvesToTuple, writeBackWhatWasRead};
