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
    });
});
