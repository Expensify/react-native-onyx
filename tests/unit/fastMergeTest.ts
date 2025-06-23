import type {DeepRecord} from '../../lib/types';
import utils from '../../lib/utils';

type DeepObject = DeepRecord<string, unknown> | unknown[];

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

    it('should replace an object with an array', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = utils.fastMerge(testObject, [1, 2, 3] as any, {
            shouldRemoveNestedNulls: true,
        });

        expect(result.result).toEqual([1, 2, 3]);
    });

    it('should replace an array with an object', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = utils.fastMerge([1, 2, 3] as any, testObject, {
            shouldRemoveNestedNulls: true,
        });

        expect(result.result).toEqual(testObject);
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
});
