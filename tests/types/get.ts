import Onyx from '../../dist/Onyx';
import ONYX_KEYS from './setup';

/**
 * `Onyx.get` and `useOnyx` hand back the same cached object, so they agree on its type: neither is
 * deeply readonly. Not mutating a cached value is a convention documented on `Onyx.get`, not something
 * the type system enforces, because enforcing it on one surface and not the other only makes the read
 * harder to adopt than the subscription it replaces. These assignments fail if that ever drifts.
 */
async function readCollectionMember() {
    const member = await Onyx.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`);

    if (!member) {
        return;
    }

    member.str = 'assignable';

    return member;
}

async function readCollection() {
    const collection = await Onyx.get(ONYX_KEYS.COLLECTION.TEST_KEY);

    if (!collection) {
        return;
    }

    collection.test_1 = {str: 'assignable'};

    return collection;
}

export {readCollectionMember, readCollection};
