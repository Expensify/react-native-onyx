import classifyIDBError from '../../../../lib/storage/providers/IDBKeyValProvider/classifyError';
import {StorageErrorClass} from '../../../../lib/storage/errors';

describe('classifyIDBError', () => {
    it('classifies "Failed to write blobs (IOError)" as UNRECOVERABLE', () => {
        const error = new DOMException('Failed to write blobs (IOError)', 'DataError');
        expect(classifyIDBError(error)).toBe(StorageErrorClass.UNRECOVERABLE);
    });

    it('classifies "Failed to write blobs (InvalidBlob)" as UNRECOVERABLE', () => {
        const error = new DOMException('Failed to write blobs (InvalidBlob)', 'DataError');
        expect(classifyIDBError(error)).toBe(StorageErrorClass.UNRECOVERABLE);
    });

    it('classifies quota exceeded as CAPACITY', () => {
        expect(classifyIDBError(new DOMException('quota', 'QuotaExceededError'))).toBe(StorageErrorClass.CAPACITY);
    });

    it('classifies backing-store corruption as FATAL', () => {
        expect(classifyIDBError(new DOMException('Internal error opening backing store for indexedDB.open.', 'UnknownError'))).toBe(StorageErrorClass.FATAL);
    });

    it('classifies an unrecognized error as UNKNOWN', () => {
        expect(classifyIDBError(new DOMException('something we have never seen', 'WeirdError'))).toBe(StorageErrorClass.UNKNOWN);
    });
});
