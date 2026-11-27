import useOnyxState from '../../dist/useOnyxState';
import ONYX_KEYS from './setup';

function readCollectionRoot() {
    return useOnyxState((state) => {
        const collection = state[ONYX_KEYS.COLLECTION.TEST_KEY];

        if (!collection) {
            return undefined;
        }

        // A root reads back as the whole collection, so it is indexable by member key.
        const draft: typeof collection = {...collection};
        draft.test_1 = {str: 'mutated'};

        return draft;
    });
}

function readCollectionMember() {
    return useOnyxState((state) => {
        const member = state[`${ONYX_KEYS.COLLECTION.TEST_KEY}1`];

        if (!member) {
            return undefined;
        }

        // Annotation pins the draft to the read type because a spread alone drops readonly modifiers.
        const draft: typeof member = {...member, list: member.list ? [...member.list] : undefined};
        draft.str = 'mutated';
        draft.list?.push('appended');

        return draft;
    });
}

function readSingleKey() {
    return useOnyxState((state) => state[ONYX_KEYS.TEST_KEY]?.toUpperCase());
}

function rootIsNotAMember() {
    return useOnyxState((state) => {
        // @ts-expect-error a root reads as the whole collection, so it is not one member
        const member: {str: string} | undefined = state[ONYX_KEYS.COLLECTION.TEST_KEY];

        return member;
    });
}

function memberIsNotACollection() {
    return useOnyxState((state) => {
        const member = state[`${ONYX_KEYS.COLLECTION.TEST_KEY}1`];

        // @ts-expect-error a member is one entry, not a collection keyed by member key
        return member?.test_1;
    });
}

function readsAnyKey() {
    return useOnyxState((state) => `${state[ONYX_KEYS.TEST_KEY] ?? ''}${state[`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]?.str ?? ''}`);
}

export {readCollectionRoot, readCollectionMember, readSingleKey, rootIsNotAMember, memberIsNotACollection, readsAnyKey};
