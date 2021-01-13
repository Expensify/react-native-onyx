import 'react-native';
import Onyx from '../../index';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const TEST_KEY = 'test';

Onyx.registerLogger(() => {});
Onyx.init({
    keys: {
        TEST_KEY,
        COLLECTOnyx: {},
    },
    registerStorageEventListener: () => {},
});

describe('Onyx', () => {
    let connectionID;

    afterEach(() => {
        Onyx.disconnect(connectionID);
        return Onyx.clear();
    });

    it('should set a simple key', () => {
        let testKeyValue;

        connectionID = Onyx.connect({
            key: TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        // Set a simple key
        return Onyx.set(TEST_KEY, 'test')
            .then(() => {
                expect(testKeyValue).toBe('test');
            });
    });

    it('should merge an object with another object', () => {
        let testKeyValue;

        connectionID = Onyx.connect({
            key: TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(TEST_KEY, {test1: 'test1'})
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1'});
                Onyx.merge(TEST_KEY, {test2: 'test2'});
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1', test2: 'test2'});
            });
    });

    it('should notify subscribers when data has been cleared', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
            key: TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            }
        });

        return Onyx.set(TEST_KEY, 'test')
            .then(() => {
                expect(testKeyValue).toBe('test');
                return Onyx.clear();
            })
            .then(() => {
                expect(testKeyValue).toBeNull();
            });
    });

    it('should not notify subscribers after they have disconnected', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
            key: TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(TEST_KEY, 'test')
            .then(() => {
                expect(testKeyValue).toBe('test');
                Onyx.disconnect(connectionID);
                return Onyx.set(TEST_KEY, 'test updated');
            })
            .then(() => {
                // Test value has not changed
                expect(testKeyValue).toBe('test');
            });
    });

    it('should merge arrays by appending new items to the end of a value', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
            key: TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(TEST_KEY, ['test1'])
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test1']);
                Onyx.merge(TEST_KEY, ['test2', 'test3', 'test4']);
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test1', 'test2', 'test3', 'test4']);
            });
    });

    it('should merge 2 objects when it has no initial stored value for test key', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
            key: TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        Onyx.merge(TEST_KEY, {test1: 'test1'});
        Onyx.merge(TEST_KEY, {test2: 'test2'});
        return waitForPromisesToResolve()
            .then(() => {
                expect(testKeyValue).toStrictEqual({test1: 'test1', test2: 'test2'});
            });
    });

    it('should merge 2 arrays when it has no initial stored value for test key', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
            key: TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        Onyx.merge(TEST_KEY, ['test1']);
        Onyx.merge(TEST_KEY, ['test2']);
        return waitForPromisesToResolve()
            .then(() => {
                expect(testKeyValue).toEqual(['test1', 'test2']);
            });
    });
});
