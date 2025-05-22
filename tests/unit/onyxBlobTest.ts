import type {Connection} from '../../lib';
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

    it('should store and retrieve a Blob with the correct content', async () => {
        // Define the test content
        const blobTestContent = 'test blob content';
        let testBlobValue: unknown;

        // Create a test Blob with the expected content
        const testBlob = new Blob([blobTestContent], {type: 'text/plain'});

        // Connect to the test key
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_BLOB,
            initWithStoredValues: false,
            callback: (value) => {
                testBlobValue = value;
            },
        });

        // Set the Blob value
        await Onyx.set(ONYX_KEYS.TEST_BLOB, testBlob);

        // Verify that the value is an instance of Blob
        expect(testBlobValue instanceof Blob).toBeTruthy();
    });
});
