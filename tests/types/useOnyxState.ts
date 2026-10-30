import useOnyxState from '../../dist/useOnyxState';
import ONYX_KEYS from './setup';

function readCollectionRoot() {
    return useOnyxState(
        (state) => {
            const collection = state[ONYX_KEYS.COLLECTION.TEST_KEY];

            if (!collection) {
                return undefined;
            }

            // A root reads back as the whole collection, so it is indexable by member key.
            const draft: typeof collection = {...collection};
            draft.test_1 = {str: 'mutated'};

            return draft;
        },
        {dependencies: [ONYX_KEYS.COLLECTION.TEST_KEY]},
    );
}

function readCollectionMember() {
    return useOnyxState(
        (state) => {
            const member = state[`${ONYX_KEYS.COLLECTION.TEST_KEY}1`];

            if (!member) {
                return undefined;
            }

            // Annotation pins the draft to the read type because a spread alone drops readonly modifiers.
            const draft: typeof member = {...member, list: member.list ? [...member.list] : undefined};
            draft.str = 'mutated';
            draft.list?.push('appended');

            return draft;
        },
        {dependencies: [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]},
    );
}

function readSingleKey() {
    return useOnyxState((state) => state[ONYX_KEYS.TEST_KEY]?.toUpperCase(), {dependencies: [ONYX_KEYS.TEST_KEY]});
}

function readPreviousState() {
    return useOnyxState(
        (state, previousState) => {
            const current = state[ONYX_KEYS.COLLECTION.TEST_KEY];
            const previous = previousState?.[ONYX_KEYS.COLLECTION.TEST_KEY];

            // Both sides are collections, so changed members can be found by reference.
            return Object.keys(current ?? {}).filter((key) => current?.[key] !== previous?.[key]);
        },
        {dependencies: [ONYX_KEYS.COLLECTION.TEST_KEY]},
    );
}

function rootIsNotAMember() {
    return useOnyxState(
        (state) => {
            // @ts-expect-error a root reads as the whole collection, so it is not one member
            const member: {str: string} | undefined = state[ONYX_KEYS.COLLECTION.TEST_KEY];

            return member;
        },
        {dependencies: [ONYX_KEYS.COLLECTION.TEST_KEY]},
    );
}

function memberIsNotACollection() {
    return useOnyxState(
        (state) => {
            const member = state[`${ONYX_KEYS.COLLECTION.TEST_KEY}1`];

            // @ts-expect-error a member is one entry, not a collection keyed by member key
            return member?.test_1;
        },
        {dependencies: [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]},
    );
}

export {readCollectionRoot, readCollectionMember, readSingleKey, readPreviousState, rootIsNotAMember, memberIsNotACollection};
