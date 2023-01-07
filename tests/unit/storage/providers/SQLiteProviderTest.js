/* eslint-disable arrow-body-style */
import SQLiteStorage from '../../../../lib/storage/providers/SQLiteStorage';

afterEach(() => {
    return SQLiteStorage.clear();
});

describe('SQLiteStorage', () => {
    it('returns a null value for a key that does not exist', () => {
        return SQLiteStorage.getItem('test').then((value) => {
            expect(value).toBe(null);
        });
    });

    it('sets a value for a key and retrieves it', () => {
        return SQLiteStorage.setItem('test', 'value')
            .then(() => {
                return SQLiteStorage.getItem('test');
            })
            .then((value) => {
                expect(value).toBe('value');
            });
    });

    it('can get multiple values for different keys via multiGet', () => {
        return SQLiteStorage.setItem('test_1', 'valueOne')
            .then(() => SQLiteStorage.setItem('test_2', 'valueTwo'))
            .then(() => {
                return SQLiteStorage.multiGet(['test_1', 'test_2']);
            })
            .then((values) => {
                const [keyOne, valueOne] = values[0];
                const [keyTwo, valueTwo] = values[1];
                expect(keyOne).toBe('test_1');
                expect(valueOne).toBe('valueOne');
                expect(keyTwo).toBe('test_2');
                expect(valueTwo).toBe('valueTwo');
            });
    });

    it('can set multiple values at once', () => {
        return SQLiteStorage.multiSet([['test_3', 'valueThree'], ['test_4', 'valueFour']])
            .then(() => {
                return SQLiteStorage.multiGet(['test_3', 'test_4']);
            })
            .then((values) => {
                const [keyOne, valueOne] = values[0];
                const [keyTwo, valueTwo] = values[1];
                expect(keyOne).toBe('test_3');
                expect(valueOne).toBe('valueThree');
                expect(keyTwo).toBe('test_4');
                expect(valueTwo).toBe('valueFour');
            });
    });

    it('can set merge multiple values at once', () => {
        return SQLiteStorage.multiSet([['object1', {one: 1}], ['object2', {two: 2}]])
            .then(() => {
                return SQLiteStorage.multiMerge([['object1', {two: 2}], ['object2', {one: 1}]]);
            })
            .then(() => {
                return SQLiteStorage.multiGet(['object1', 'object2']);
            })
            .then((values) => {
                const [keyOne, valueOne] = values[0];
                const [keyTwo, valueTwo] = values[1];
                expect(keyOne).toBe('object1');
                expect(valueOne).toStrictEqual({one: 1, two: 2});
                expect(keyTwo).toBe('object2');
                expect(valueTwo).toStrictEqual({two: 2, one: 1});
            });
    });

    it('can get all the keys in storage', () => {
        return SQLiteStorage.multiSet([['object1', {one: 1}], ['object2', {two: 2}]])
            .then(() => {
                return SQLiteStorage.getAllKeys();
            })
            .then((keys) => {
                expect(keys).toEqual(['object1', 'object2']);
            });
    });

    it('can remove a key from storage', () => {
        return SQLiteStorage.multiSet([['object1', {one: 1}], ['object2', {two: 2}]])
            .then(() => {
                return SQLiteStorage.removeItem('object1');
            })
            .then(() => {
                return SQLiteStorage.getAllKeys();
            })
            .then((keys) => {
                expect(keys).toEqual(['object2']);
            });
    });
});

