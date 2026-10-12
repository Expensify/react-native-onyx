import Onyx from '../../dist/Onyx';
import ONYX_KEYS from './setup';

async function readCollectionMember() {
    const member = await Onyx.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`);

    if (!member) {
        return;
    }

    // Annotation pins the draft to the read type because a spread alone drops readonly modifiers.
    const draft: typeof member = {...member, list: member.list ? [...member.list] : undefined};
    draft.str = 'mutated';
    draft.list?.push('appended');

    return draft;
}

async function readCollection() {
    const collection = await Onyx.get(ONYX_KEYS.COLLECTION.TEST_KEY);

    if (!collection) {
        return;
    }

    const draft: typeof collection = {...collection};
    draft.test_1 = {str: 'mutated'};

    return draft;
}

async function writeBackWhatWasRead() {
    const value = await Onyx.get(ONYX_KEYS.TEST_KEY);
    await Onyx.set(ONYX_KEYS.TEST_KEY, value ?? null);
    await Onyx.merge(ONYX_KEYS.TEST_KEY, value ?? null);

    const member = await Onyx.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`);

    if (!member) {
        return;
    }

    await Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, member);
    await Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, member);
}

async function writeBackWholeCollectionNeedsDefinedMembers() {
    const collection = await Onyx.get(ONYX_KEYS.COLLECTION.TEST_KEY);

    if (!collection) {
        return;
    }

    // @ts-expect-error undefined members are not valid write input
    await Onyx.setCollection(ONYX_KEYS.COLLECTION.TEST_KEY, collection);
}
