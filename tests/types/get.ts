import Onyx from '../../dist/Onyx';
import ONYX_KEYS from './setup';

/**
 * `Onyx.get` resolves to the object the cache holds, typed as mutable, so callers may mutate it locally
 * and hand it straight back to the write methods.
 */
async function readCollectionMember() {
    const member = await Onyx.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`);

    if (!member) {
        return;
    }

    member.str = 'mutated';
    member.list?.push('appended');

    return {...member, str: 'copied'};
}

async function readCollection() {
    const collection = await Onyx.get(ONYX_KEYS.COLLECTION.TEST_KEY);

    if (!collection) {
        return;
    }

    collection.test_1 = {str: 'mutated'};

    return {...collection};
}

/** Values read with `get()` go straight back into the write methods. */
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

/** A collection read types its members as possibly undefined, which the collection writes reject. */
async function writeBackWholeCollectionNeedsDefinedMembers() {
    const collection = await Onyx.get(ONYX_KEYS.COLLECTION.TEST_KEY);

    if (!collection) {
        return;
    }

    // @ts-expect-error undefined members are not valid write input
    await Onyx.setCollection(ONYX_KEYS.COLLECTION.TEST_KEY, collection);
}

export {readCollectionMember, readCollection, writeBackWhatWasRead, writeBackWholeCollectionNeedsDefinedMembers};
