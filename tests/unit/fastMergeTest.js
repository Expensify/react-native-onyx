import utils from '../../lib/utils';

const testObject = {
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

const testObjectWithNullishValues = {
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

const testObjectWithNullValuesRemoved = {
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

    it('should remove null values by merging two identical objects with fastMerge', () => {
        const result = utils.removeNestedNullValues(testObjectWithNullishValues);

        expect(result).toEqual(testObjectWithNullValuesRemoved);
    });

    it('should replace an object with an array', () => {
        const result = utils.fastMerge(testObject, [1, 2, 3]);

        expect(result).toEqual([1, 2, 3]);
    });

    it('should replace an array with an object', () => {
        const result = utils.fastMerge([1, 2, 3], testObject);

        expect(result).toEqual(testObject);
    });
});
