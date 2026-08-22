import {getErrorParts} from '../../../lib/storage/errors';

describe('getErrorParts', () => {
    it('should extract name and message from Error instances', () => {
        expect(getErrorParts(new TypeError('Could not be cloned'))).toEqual({
            name: 'typeerror',
            message: 'could not be cloned',
        });
    });

    it('should lowercase string throws', () => {
        expect(getErrorParts('Quota exceeded')).toEqual({name: '', message: 'quota exceeded'});
    });

    it('should treat null and undefined as empty', () => {
        expect(getErrorParts(null)).toEqual({name: '', message: ''});
        expect(getErrorParts(undefined)).toEqual({name: '', message: ''});
    });

    it('should serialize plain objects so classifiers can match fields', () => {
        expect(getErrorParts({message: 'QuotaExceededError'})).toEqual({
            name: '',
            message: '{"message":"quotaexceedederror"}',
        });
    });

    it('should not throw on circular objects', () => {
        const circular: {self?: unknown} = {};
        circular.self = circular;

        expect(() => getErrorParts(circular)).not.toThrow();
        expect(getErrorParts(circular)).toEqual({name: '', message: '[object object]'});
    });

    it('should not throw on BigInt', () => {
        expect(() => getErrorParts(1n)).not.toThrow();
        expect(getErrorParts(1n)).toEqual({name: '', message: '1'});
    });
});
