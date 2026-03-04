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

        it('should remove null values by merging two identical objects with fastMerge', () => {
            const result = utils.removeNestedNullValues(testObjectWithNullishValues);

            expect(result).toEqual(testObjectWithNullValuesRemoved);
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
        ])('should replace %s with an object', (_label, data) => {
            const result = utils.fastMerge<unknown>(data, testObject);
            expect(result.result).toEqual(testObject);
        });

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
    });

    describe('removeNestedNullValues', () => {
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

        it('should preserve sibling references when a nested null is removed', () => {
            const sibling = {x: 1};
            const value = {a: sibling, b: {c: null}};
            const result = utils.removeNestedNullValues(value);
            expect(result).not.toBe(value);
            expect((result as Record<string, unknown>).a).toBe(sibling);
        });
    });
});
