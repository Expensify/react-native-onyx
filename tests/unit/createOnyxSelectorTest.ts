import {act, renderHook} from '@testing-library/react-native';

import type {OnyxCollection} from '../../lib';

import Onyx, {createOnyxSelector, useOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

type Item = {id: number; login: string};

const ONYXKEYS = {
    COLLECTION: {
        ITEMS: 'items_',
    },
};

Onyx.init({keys: ONYXKEYS});

beforeEach(async () => {
    await Onyx.clear();
});

describe('createOnyxSelector', () => {
    it('returns the cached result when called again with the same arguments', () => {
        // Given a wrapped selector and one input object
        const combiner = jest.fn((items: Record<string, Item>) => Object.values(items).map((item) => item.id));
        const selector = createOnyxSelector(combiner);
        const items = {a: {id: 1, login: 'a@test.com'}};

        // When it is called twice with that same object
        const first = selector(items);
        const second = selector(items);

        // Then the combiner runs once and both calls get the same reference
        expect(combiner).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
    });

    it('recomputes when the input object is replaced', () => {
        // Given a wrapped selector that already has a result for one object
        const combiner = jest.fn((items: Record<string, Item>) => Object.keys(items).length);
        const selector = createOnyxSelector(combiner);
        selector({a: {id: 1, login: 'a@test.com'}});

        // When it is called with a new object, as Onyx does after a write
        const result = selector({a: {id: 1, login: 'a@test.com'}, b: {id: 2, login: 'b@test.com'}});

        // Then the combiner runs again, because the cache is keyed on identity, not contents
        expect(combiner).toHaveBeenCalledTimes(2);
        expect(result).toBe(2);
    });

    it('keeps a separate result for each value of an extra argument', () => {
        // Given a wrapped selector that takes a login next to the collection
        const combiner = jest.fn((items: Record<string, Item>, login: string) => Object.values(items).find((item) => item.login === login)?.id);
        const selector = createOnyxSelector(combiner);
        const items = {a: {id: 1, login: 'a@test.com'}, b: {id: 2, login: 'b@test.com'}};

        // When it is called with two logins, then with the first one again
        const first = selector(items, 'a@test.com');
        const second = selector(items, 'b@test.com');
        const firstAgain = selector(items, 'a@test.com');

        // Then each login gets its own result and the repeated call is served from the cache
        expect(first).toBe(1);
        expect(second).toBe(2);
        expect(firstAgain).toBe(1);
        expect(combiner).toHaveBeenCalledTimes(2);
    });

    it('caches results for undefined and other primitive inputs', () => {
        // Given a wrapped selector called before its Onyx value exists
        const combiner = jest.fn((items: Record<string, Item> | undefined) => Object.keys(items ?? {}).length);
        const selector = createOnyxSelector(combiner);

        // When it is called twice with undefined
        selector(undefined);
        selector(undefined);

        // Then the combiner runs once, so a missing value is not recomputed on every notification
        expect(combiner).toHaveBeenCalledTimes(1);
    });

    it('shares one computation across useOnyx instances that read the same value', async () => {
        // Given a collection and a wrapped selector used by three components at once
        await Onyx.multiSet({[`${ONYXKEYS.COLLECTION.ITEMS}1`]: {id: 1, login: 'a@test.com'}, [`${ONYXKEYS.COLLECTION.ITEMS}2`]: {id: 2, login: 'b@test.com'}});
        const combiner = jest.fn((items: OnyxCollection<Item>, login: string) => Object.values(items ?? {}).find((item) => item?.login === login)?.id);
        const accountIDByLogin = createOnyxSelector(combiner);
        const useAccountID = (login: string) => useOnyx(ONYXKEYS.COLLECTION.ITEMS, {selector: (items) => accountIDByLogin(items as OnyxCollection<Item>, login)});

        const hooks = [renderHook(() => useAccountID('b@test.com')), renderHook(() => useAccountID('b@test.com')), renderHook(() => useAccountID('b@test.com'))];
        await act(waitForPromisesToResolve);
        combiner.mockClear();

        // When one member of the collection changes
        await act(async () => Onyx.merge(`${ONYXKEYS.COLLECTION.ITEMS}1`, {login: 'c@test.com'}));

        // Then the combiner runs once for the new collection instead of once per component, and every component still sees the result
        expect(combiner).toHaveBeenCalledTimes(1);
        for (const {result} of hooks) {
            expect(result.current[0]).toBe(2);
        }
    });
});
