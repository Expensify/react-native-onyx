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

describe('fastMerge', () => {
    it('should merge an object with another object and remove nested null values', () => {
        const result = utils.fastMerge(testObject, testObjectWithNullishValues);

        expect(result).toEqual({
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
        const result = utils.fastMerge(testObject, testObjectWithNullishValues, false);

        expect(result).toEqual({
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
        const result = utils.fastMerge({}, testObjectWithNullishValues);

        expect(result).toEqual(testObjectWithNullValuesRemoved);
    });

    it('should remove null values by merging two identical objects with fastMerge', () => {
        const result = utils.removeNestedNullValues(testObjectWithNullishValues);

        expect(result).toEqual(testObjectWithNullValuesRemoved);
    });

    it('should replace an object with an array', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = utils.fastMerge(testObject, [1, 2, 3] as any);

        expect(result).toEqual([1, 2, 3]);
    });

    it('should replace an array with an object', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = utils.fastMerge([1, 2, 3] as any, testObject);

        expect(result).toEqual(testObject);
    });
});
