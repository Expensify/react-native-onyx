import Onyx from '../../dist/Onyx';
import ONYX_KEYS from './setup';

/**
 * `Onyx.get` resolves to the object the cache holds rather than a copy, so its type is deeply readonly.
 * Each `@ts-expect-error` below fails this typecheck if that ever stops being true.
 */
async function readCollectionMember() {
    const member = await Onyx.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`);

    if (!member) {
        return;
    }

    // @ts-expect-error the cached object is readonly
    member.str = 'mutated';

    const copy = {...member, str: 'copied'};

    return copy;
}

async function readCollection() {
    const collection = await Onyx.get(ONYX_KEYS.COLLECTION.TEST_KEY);

    if (!collection) {
        return;
    }

    // @ts-expect-error a member of the cached collection is readonly
    collection.test_1 = {str: 'mutated'};

    return {...collection};
}

export {readCollectionMember, readCollection};
