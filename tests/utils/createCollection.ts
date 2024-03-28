import {randAvatar, randEmail, randWord} from '@ngneat/falso';

type PersonalDetailsMock = {
    accountID: number;
    avatar: string;
    displayName: string;
    lastName: string;
    login: string;
};

function createCollection<T>(createKey: (item: T, index: number) => string | number, createItem: (index: number) => T, length = 500): Record<string, T> {
    const map: Record<string, T> = {};

    for (let i = 0; i < length; i++) {
        const item = createItem(i);
        const itemKey = createKey(item, i);
        map[itemKey] = item;
    }

    return map;
}

function createPersonalDetails(index: number): PersonalDetailsMock {
    return {
        accountID: index,
        avatar: randAvatar(),
        displayName: randWord(),
        lastName: randWord(),
        login: randEmail(),
    };
}

export {createCollection, createPersonalDetails};
export type {PersonalDetailsMock};
