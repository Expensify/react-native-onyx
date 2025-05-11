import {Connection} from '../../lib';
import Onyx from '../../lib/Onyx';

// Define test keys
const ONYX_KEYS = {
    TEST_BLOB: 'testBlob',
};

describe('Onyx Blob Handling', () => {
    let connection: Connection | undefined;

    afterEach(() => {
        if (connection) {
            Onyx.disconnect(connection);
        }
        return Onyx.clear();
    });

    it('should set a Blob value correctly', () => {
        let testBlobValue: unknown;

        // Create a test Blob
        const testBlob = new Blob(['test blob content'], {type: 'text/plain'});

        // Connect to the test key
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_BLOB,
            initWithStoredValues: false,
            callback: (value) => {
                testBlobValue = value;
            },
        });

        // Set the Blob value
        return Onyx.set(ONYX_KEYS.TEST_BLOB, testBlob).then(() => {
            // In IndexedDB, when we check if the value is instace of Blob it will return false, because the returned object still has all the blob data, but it's no longer an instance of the Blob constructor
            // See more here at the last point: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#things_that_dont_work_with_structured_clone

            // So we can only check the value is set (not null or undefined)
            expect(testBlobValue).toBeTruthy();
        });
    });
});
