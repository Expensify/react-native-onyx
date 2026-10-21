import utils from '../../lib/utils';
import type {GenericDeepRecord} from '../types';

type DeepObject = GenericDeepRecord | unknown[];

const testObject: DeepObject = {
    a: 'a',
    b: {
        c: 'c',
        d: {
            e: 'e',
            f: 'f',
        },
        g: 'g',
    },
};

const testObjectWithNullishValues: DeepObject = {
    a: undefined,
    b: {
        c: {
            h: 'h',
        },
        d: {
            e: null,
        },
    },
};

const testObjectWithNullValuesRemoved: DeepObject = {
    b: {
        c: {
            h: 'h',
        },
        d: {},
    },
};

const testMergeChanges: DeepObject[] = [
    {
        b: {
            d: {
                h: 'h',
            },
        },
    },
    {
        b: {
            d: null,
            h: 'h',
        },
    },
];

const KEEP_EQUAL_ARRAYS = {shouldKeepEqualArrays: true};

describe('utils', () => {
    describe('fastMerge', () => {
        describe('primitives', () => {
            it('should replace strings', () => {
                const result = utils.fastMerge('old', 'new');
                expect(result.result).toEqual('new');
            });

            it('should replace numbers', () => {
                const result = utils.fastMerge(1000, 1001);
                expect(result.result).toEqual(1001);
            });

            it('should replace booleans', () => {
                const result = utils.fastMerge(true, false);
                expect(result.result).toEqual(false);
            });
        });

        describe('arrays', () => {
            it('should replace arrays', () => {
                const result = utils.fastMerge(['a', 1, true], ['b', false]);
                expect(result.result).toEqual(['b', false]);
            });
        });

        describe('objects', () => {
            it('should merge an object with another object and remove nested null values', () => {
                const result = utils.fastMerge(testObject, testObjectWithNullishValues, {shouldRemoveNestedNulls: true});

                expect(result.result).toEqual({
                    a: 'a',
                    b: {
                        c: {
                            h: 'h',
                        },
                        d: {
                            f: 'f',
                        },
                        g: 'g',
                    },
                });
            });

            it('should merge an object with another object and not remove nested null values', () => {
                const result = utils.fastMerge(testObject, testObjectWithNullishValues);

                expect(result.result).toEqual({
                    a: 'a',
                    b: {
                        c: {
                            h: 'h',
                        },
                        d: {
                            e: null,
                            f: 'f',
                        },
                        g: 'g',
                    },
                });
            });

            it('should merge an object with an empty object and remove deeply nested null values', () => {
                const result = utils.fastMerge({}, testObjectWithNullishValues, {
                    shouldRemoveNestedNulls: true,
                });

                expect(result.result).toEqual(testObjectWithNullValuesRemoved);
            });

            it('should replace Date objects', () => {
                const oldDate = new Date('2024-01-01');
                const newDate = new Date('2025-01-01');
                const result = utils.fastMerge(oldDate, newDate);
                expect(result.result).toEqual(newDate);
            });

            it('should replace RegExp objects', () => {
                const oldRegex = /old/gi;
                const newRegex = /new/i;
                const result = utils.fastMerge(oldRegex, newRegex);
                expect(result.result).toEqual(newRegex);
            });

            it('should add the "ONYX_INTERNALS__REPLACE_OBJECT_MARK" flag to the merged object when the change is set to null and "objectRemovalMode" is set to "mark"', () => {
                const result = utils.fastMerge(testMergeChanges[1], testMergeChanges[0], {
                    shouldRemoveNestedNulls: true,
                    objectRemovalMode: 'mark',
                });

                expect(result.result).toEqual({
                    b: {
                        d: {
                            h: 'h',
                            [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                        },
                        h: 'h',
                    },
                });
                expect(result.replaceNullPatches).toEqual([[['b', 'd'], {h: 'h'}]]);
            });

            it('should completely replace the target object with its source when the source has the "ONYX_INTERNALS__REPLACE_OBJECT_MARK" flag and "objectRemovalMode" is set to "replace"', () => {
                const result = utils.fastMerge(
                    testObject,
                    {
                        b: {
                            d: {
                                h: 'h',
                                [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                            },
                            h: 'h',
                        },
                    },
                    {
                        shouldRemoveNestedNulls: true,
                        objectRemovalMode: 'replace',
                    },
                );

                expect(result.result).toEqual({
                    a: 'a',
                    b: {
                        c: 'c',
                        d: {
                            h: 'h',
                        },
                        h: 'h',
                        g: 'g',
                    },
                });
            });

            test.each([
                ['a string', 'value'],
                ['a number', 1000],
                ['a boolean', true],
                ['an array', []],
            ])('should replace an object with %s', (_label, expected) => {
                const result = utils.fastMerge<unknown>(testObject, expected);
                expect(result.result).toEqual(expected);
            });

            test.each([
                ['a string', 'value'],
                ['a number', 1000],
                ['a boolean', true],
                ['an array', []],
                ['null', null],
                ['undefined', undefined],
            ])('should replace %s with an object', (_label, data) => {
                const result = utils.fastMerge<unknown>(data, testObject);
                expect(result.result).toEqual(testObject);
            });
        });

        describe('reference stability', () => {
            it('should return the same reference when source values match target', () => {
                const target = {a: 1, b: 'hello', c: true};
                const source = {a: 1, b: 'hello'};
                const result = utils.fastMerge(target, source);
                expect(result.result).toBe(target);
            });

            it('should return a new reference when source adds a key', () => {
                const target = {a: 1};
                const source = {a: 1, b: 2};
                const result = utils.fastMerge(target, source);
                expect(result.result).not.toBe(target);
                expect(result.result).toEqual({a: 1, b: 2});
            });

            it('should return a new reference when source changes a value', () => {
                const target = {a: 1, b: 2};
                const source = {b: 3};
                const result = utils.fastMerge(target, source);
                expect(result.result).not.toBe(target);
                expect(result.result).toEqual({a: 1, b: 3});
            });

            it('should preserve nested object references when unchanged', () => {
                const nested = {x: 1, y: 2};
                const target = {a: 'hello', b: nested};
                const source = {a: 'hello'};
                const result = utils.fastMerge<GenericDeepRecord>(target, source);
                expect(result.result).toBe(target);
                expect(result.result.b).toBe(nested);
            });

            it('should preserve unchanged nested references when sibling changes', () => {
                const nested = {x: 1, y: 2};
                const target = {a: nested, b: 'old'};
                const source = {b: 'new'};
                const result = utils.fastMerge<GenericDeepRecord>(target, source);
                expect(result.result).not.toBe(target);
                expect(result.result.a).toBe(nested);
            });

            it('should return a new reference when nested object changes', () => {
                const target = {a: {x: 1, y: 2}, b: 'hello'};
                const source = {a: {x: 99}};
                const result = utils.fastMerge(target, source);
                expect(result.result).not.toBe(target);
                expect(result.result.a).not.toBe(target.a);
                expect(result.result.a).toEqual({x: 99, y: 2});
            });

            it('should return a new reference when shouldRemoveNestedNulls removes a key', () => {
                const target = {a: 1, b: null};
                const source = {a: 1};
                const result = utils.fastMerge(target, source, {shouldRemoveNestedNulls: true});
                expect(result.result).not.toBe(target);
                expect(result.result).toEqual({a: 1});
            });

            it('should return the same reference when merging with empty source keys', () => {
                const target = {a: 1, b: 2};
                const source = {};
                const result = utils.fastMerge(target, source);
                expect(result.result).toBe(target);
            });

            it('should skip undefined source values and preserve target reference', () => {
                const target = {a: 1, b: 2};
                const source = {a: undefined};
                const result = utils.fastMerge<GenericDeepRecord>(target, source);
                expect(result.result).toBe(target);
            });

            it('should preserve references through deeply nested merges (3+ levels)', () => {
                const deepNested = {x: 1};
                const target = {a: {b: {c: deepNested}}, d: 'hello'};
                const source = {d: 'hello'};
                const result = utils.fastMerge<GenericDeepRecord>(target, source);
                expect(result.result).toBe(target);
                expect(result.result.a.b.c).toBe(deepNested);
            });

            it('should return a new reference at each changed level in a deep merge', () => {
                const target = {a: {b: {c: 1, d: 2}}, e: 'unchanged'};
                const source = {a: {b: {c: 99}}};
                const result = utils.fastMerge<GenericDeepRecord>(target, source);
                expect(result.result).not.toBe(target);
                expect(result.result.a).not.toBe(target.a);
                expect(result.result.a.b).not.toBe(target.a.b);
                expect(result.result.a.b).toEqual({c: 99, d: 2});
            });

            it('should return the source array when "shouldKeepEqualArrays" is not set', () => {
                const source = [1, 2];
                expect(utils.fastMerge([1, 2], source).result).toBe(source);

                const nestedSource = {a: [1]};
                const result = utils.fastMerge<GenericDeepRecord>({a: [1]}, nestedSource);
                expect(result.result.a).toBe(nestedSource.a);
            });

            it('should return the target array when the source array is deep-equal', () => {
                const target = [1, 2];
                const result = utils.fastMerge(target, [1, 2], KEEP_EQUAL_ARRAYS);
                expect(result.result).toBe(target);
            });

            it('should return the source array when the source array differs', () => {
                const target = [1, 2];
                const source = [1, 3];
                const result = utils.fastMerge(target, source, KEEP_EQUAL_ARRAYS);
                expect(result.result).toBe(source);
            });

            it('should return the target array when merging an empty array into an empty array', () => {
                const target: unknown[] = [];
                const result = utils.fastMerge(target, [], KEEP_EQUAL_ARRAYS);
                expect(result.result).toBe(target);
            });

            it('should return the target object when a nested array is deep-equal', () => {
                const nestedArray = [{x: 1}];
                const target = {a: nestedArray, b: 1};
                const source = {a: [{x: 1}]};
                const result = utils.fastMerge<GenericDeepRecord>(target, source, KEEP_EQUAL_ARRAYS);
                expect(result.result).toBe(target);
                expect(result.result.a).toBe(nestedArray);
            });

            it.each([
                ['before', {b: 2, a: [1]}],
                ['after', {a: [1], b: 2}],
            ])('should not compare a nested array when a sibling %s it changes', (_, source) => {
                const target = {a: [1], b: 1};
                const result = utils.fastMerge<GenericDeepRecord>(target, source, KEEP_EQUAL_ARRAYS);
                expect(result.result).toEqual({a: [1], b: 2});
                expect(result.result.a).toBe(source.a);
            });

            it('should not compare a nested array when a target key is removed', () => {
                const target = {a: [1], b: 1};
                const source = {a: [1], b: null};
                const result = utils.fastMerge<GenericDeepRecord>(target, source, {...KEEP_EQUAL_ARRAYS, shouldRemoveNestedNulls: true});
                expect(result.result).toEqual({a: [1]});
                expect(result.result.a).toBe(source.a);
            });

            it('should preserve a nested object with deep-equal arrays when a sibling of that object changes', () => {
                const nestedObject = {a: [1]};
                const target = {x: nestedObject, b: 1};
                const source = {x: {a: [1]}, b: 2};
                const result = utils.fastMerge<GenericDeepRecord>(target, source, KEEP_EQUAL_ARRAYS);
                expect(result.result).not.toBe(target);
                expect(result.result.x).toBe(nestedObject);
            });

            it('should return a new object when one of several nested arrays differs', () => {
                const target = {a: [1], b: [2], c: 'c'};
                const source = {a: [1], b: [3]};
                const result = utils.fastMerge<GenericDeepRecord>(target, source, KEEP_EQUAL_ARRAYS);
                expect(result.result).not.toBe(target);
                expect(result.result).toEqual({a: [1], b: [3], c: 'c'});
            });

            it('should return the target object when several nested arrays are deep-equal', () => {
                const target = {a: [1], b: [{c: 2}], d: 'd'};
                const result = utils.fastMerge<GenericDeepRecord>(target, {a: [1], b: [{c: 2}], d: 'd'}, KEEP_EQUAL_ARRAYS);
                expect(result.result).toBe(target);
            });

            it('should return the source array when a nested array differs', () => {
                const target = {a: [{x: 1}], b: 1};
                const source = {a: [{x: 2}]};
                const result = utils.fastMerge<GenericDeepRecord>(target, source, KEEP_EQUAL_ARRAYS);
                expect(result.result).not.toBe(target);
                expect(result.result.a).toBe(source.a);
            });

            it('should treat arrays of objects with a different key order as deep-equal', () => {
                const target = [{a: 1, b: 2}];
                const result = utils.fastMerge<unknown[]>(target, [{b: 2, a: 1}], KEEP_EQUAL_ARRAYS);
                expect(result.result).toBe(target);
            });

            it('should compare null elements inside arrays as they are', () => {
                const target = [null, {a: null}];
                expect(utils.fastMerge<unknown[]>(target, [null, {a: null}], {...KEEP_EQUAL_ARRAYS, shouldRemoveNestedNulls: true}).result).toBe(target);

                const source = [null, {a: 1}];
                expect(utils.fastMerge<unknown[]>(target, source, {...KEEP_EQUAL_ARRAYS, shouldRemoveNestedNulls: true}).result).toBe(source);
            });

            it.each([
                ['an extra key in the source', [{a: 1}], [{a: 1, b: 2}]],
                ['a missing key in the source', [{a: 1, b: 2}], [{a: 1}]],
                ['an undefined value instead of a missing key', [{a: 1}], [{a: 1, b: undefined}]],
                ['a different key with the same key count', [{a: 1}], [{b: 1}]],
                ['a different nested array length', [{a: [1, 2]}], [{a: [1]}]],
                ['an array instead of an object', [{0: 1}], [[1]]],
                ['a different primitive type', [1], ['1']],
                ['a different Date', [new Date(1)], [new Date(2)]],
                ['a different Map', [new Map([['a', 1]])], [new Map([['a', 2]])]],
            ])('should return the source array when the arrays differ by %s', (_, target, source) => {
                expect(utils.fastMerge<unknown[]>(target, source, KEEP_EQUAL_ARRAYS).result).toBe(source);
            });

            it.each([
                ['nested arrays and objects', [{a: [1, {b: [2, 3]}], c: {d: 'e'}}], [{a: [1, {b: [2, 3]}], c: {d: 'e'}}]],
                ['objects without a prototype', [Object.assign(Object.create(null) as object, {a: 1})], [{a: 1}]],
                ['Dates', [new Date(1)], [new Date(1)]],
                ['Maps', [new Map([['a', {b: 1}]])], [new Map([['a', {b: 1}]])]],
                ['booleans, strings and nulls', [true, 'a', null], [true, 'a', null]],
            ])('should return the target array when the arrays contain deep-equal %s', (_, target, source) => {
                expect(utils.fastMerge<unknown[]>(target, source, KEEP_EQUAL_ARRAYS).result).toBe(target);
            });

            it('should replace an array with an object and an object with an array', () => {
                const arraySource = [1];
                const objectSource = {0: 1};
                expect(utils.fastMerge<unknown>({0: 1}, arraySource).result).toBe(arraySource);
                expect(utils.fastMerge<unknown>([1], objectSource).result).toEqual({0: 1});
            });
        });
    });

    describe('needsNormalization', () => {
        it('should return false for nullish and primitive values', () => {
            expect(utils.needsNormalization(null)).toBe(false);
            expect(utils.needsNormalization(undefined)).toBe(false);
            expect(utils.needsNormalization('a')).toBe(false);
            expect(utils.needsNormalization(0)).toBe(false);
            expect(utils.needsNormalization(false)).toBe(false);
        });

        it('should return false for an empty object', () => {
            expect(utils.needsNormalization({})).toBe(false);
        });

        it('should return false for an object without nullish values or the replace-object mark', () => {
            expect(utils.needsNormalization(testObject)).toBe(false);
        });

        it('should return true for an object with a nullish value at the top level', () => {
            expect(utils.needsNormalization({a: 'a', b: null})).toBe(true);
            expect(utils.needsNormalization({a: 'a', b: undefined})).toBe(true);
        });

        it('should return true for an object with a nullish value nested deeply', () => {
            expect(utils.needsNormalization(testObjectWithNullishValues)).toBe(true);
            expect(utils.needsNormalization({a: {b: {c: {d: null}}}})).toBe(true);
        });

        it('should return true for an object marked with the replace-object mark at the top level', () => {
            expect(utils.needsNormalization({[utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true})).toBe(true);
        });

        it('should return true for an object marked with the replace-object mark nested deeply', () => {
            expect(utils.needsNormalization({a: {b: {[utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true, c: 'c'}}})).toBe(true);
        });

        it('should return false for arrays, since arrays are stored as-is and are not normalized', () => {
            expect(utils.needsNormalization([])).toBe(false);
            expect(utils.needsNormalization([1, 2, 3])).toBe(false);
            expect(utils.needsNormalization([null, undefined])).toBe(false);
        });

        it('should not look inside nested arrays', () => {
            expect(utils.needsNormalization({a: [null, undefined]})).toBe(false);
            expect(utils.needsNormalization({a: [{b: null}]})).toBe(false);
        });

        it('should return false for Date and RegExp values, which have no enumerable properties', () => {
            expect(utils.needsNormalization({a: new Date()})).toBe(false);
            expect(utils.needsNormalization({a: /abc/})).toBe(false);
        });
    });

    describe('removeNestedNullValues', () => {
        it('should remove null values by merging two identical objects with fastMerge', () => {
            const result = utils.removeNestedNullValues(testObjectWithNullishValues);

            expect(result).toEqual(testObjectWithNullValuesRemoved);
        });

        it('should pass through primitives unchanged', () => {
            expect(utils.removeNestedNullValues('hello')).toBe('hello');
            expect(utils.removeNestedNullValues(42)).toBe(42);
            expect(utils.removeNestedNullValues(true)).toBe(true);
            expect(utils.removeNestedNullValues(null)).toBe(null);
            expect(utils.removeNestedNullValues(undefined)).toBe(undefined);
        });

        it('should return the same array reference', () => {
            const arr = [1, 2, 3];
            const result = utils.removeNestedNullValues(arr);
            expect(result).toBe(arr);
        });

        it('should return a new reference when a null property is removed', () => {
            const value = {a: 1, b: null};
            const result = utils.removeNestedNullValues(value);
            expect(result).not.toBe(value);
            expect(result).toEqual({a: 1});
        });

        it('should return a new reference when an undefined property is removed', () => {
            const value = {a: 1, b: undefined};
            const result = utils.removeNestedNullValues(value);
            expect(result).not.toBe(value);
            expect(result).toEqual({a: 1});
        });

        it('should return a new reference when a deeply nested null is removed', () => {
            const value = {a: {b: {c: null, d: 1}}};
            const result = utils.removeNestedNullValues(value);
            expect(result).not.toBe(value);
            expect(result).toEqual({a: {b: {d: 1}}});
        });

        it('should return a new empty object when all properties are null/undefined', () => {
            const value = {a: null, b: undefined, c: null};
            const result = utils.removeNestedNullValues(value);
            expect(result).not.toBe(value);
            expect(result).toEqual({});
        });

        describe('reference stability', () => {
            it('should return the same reference when no nulls exist', () => {
                const value = {a: 1, b: 'hello', c: true};
                const result = utils.removeNestedNullValues(value);
                expect(result).toBe(value);
            });

            it('should return the same reference for nested objects without nulls', () => {
                const nested = {x: 1, y: 2};
                const value = {a: 'hello', b: nested};
                const result = utils.removeNestedNullValues(value);
                expect(result).toBe(value);
                expect((result as Record<string, unknown>).b).toBe(nested);
            });

            it('should preserve sibling references when a nested null is removed', () => {
                const sibling = {x: 1};
                const value = {a: sibling, b: {c: null}};
                const result = utils.removeNestedNullValues(value);
                expect(result).not.toBe(value);
                expect((result as Record<string, unknown>).a).toBe(sibling);
            });

            it('should return the same reference for objects containing arrays', () => {
                const arr = ['a', 'b'];
                const value = {items: arr, count: 2};
                const result = utils.removeNestedNullValues(value);
                expect(result).toBe(value);
                expect((result as Record<string, unknown>).items).toBe(arr);
            });

            it('should return the same reference for an empty object', () => {
                const value = {};
                const result = utils.removeNestedNullValues(value);
                expect(result).toBe(value);
            });
        });
    });

    describe('chunkArray', () => {
        it('should return an empty array when given an empty array', () => {
            expect(utils.chunkArray([], 3)).toEqual([]);
        });

        it('should return a single chunk when the array length is less than maxChunkSize', () => {
            const items = [1, 2];
            const result = utils.chunkArray(items, 3);

            expect(result).toEqual([[1, 2]]);
            expect(result[0]).toBe(items);
        });

        it('should return a single chunk when the array length equals maxChunkSize', () => {
            const items = [1, 2, 3];
            const result = utils.chunkArray(items, 3);

            expect(result).toEqual([[1, 2, 3]]);
            expect(result[0]).toBe(items);
        });

        it('should split the array into evenly sized chunks', () => {
            expect(utils.chunkArray([1, 2, 3, 4, 5, 6], 3)).toEqual([
                [1, 2, 3],
                [4, 5, 6],
            ]);
        });

        it('should include a smaller final chunk when the array length is not divisible by maxChunkSize', () => {
            expect(utils.chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        });

        it('should create one item per chunk when maxChunkSize is 1', () => {
            expect(utils.chunkArray(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
        });

        it('should work with readonly arrays and preserve element types', () => {
            const items = Object.freeze(['x', 'y', 'z', 'w']) as readonly string[];
            const result = utils.chunkArray(items, 2);

            expect(result).toEqual([
                ['x', 'y'],
                ['z', 'w'],
            ]);
        });
    });

    describe('isEmptyObject', () => {
        it('should return true for an empty object', () => {
            expect(utils.isEmptyObject({})).toBe(true);
        });

        it('should return true for null', () => {
            expect(utils.isEmptyObject(null)).toBe(true);
        });

        it('should return false for undefined', () => {
            expect(utils.isEmptyObject(undefined)).toBe(false);
        });

        it('should return false for an object with properties', () => {
            expect(utils.isEmptyObject({a: 1})).toBe(false);
        });

        it('should return false for non-object types', () => {
            expect(utils.isEmptyObject('hello')).toBe(false);
            expect(utils.isEmptyObject(42)).toBe(false);
            expect(utils.isEmptyObject(true)).toBe(false);
        });

        it('should return true for an empty array', () => {
            expect(utils.isEmptyObject([])).toBe(true);
        });

        it('should return false for a non-empty array', () => {
            expect(utils.isEmptyObject([1, 2])).toBe(false);
        });
    });
});
