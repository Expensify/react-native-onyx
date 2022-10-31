import React from 'react';
import {render} from '@testing-library/react-native';
import {View} from 'react-native';
import Onyx, {withOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    TEST: 'test',
    COLLECTION: {
        TEST: 'test_',
    },
};

Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
});

describe('withOnyx objects should be immutable when we ', () => {
    /**
     * @param {Function} onyxMethod
     * @returns {Promise}
     */
    function testNonCollectionKey(onyxMethod) {
        const TestComponentWithOnyx = withOnyx({
            testValue: {
                key: ONYX_KEYS.TEST,
            },
        })(View);

        const result = render(<TestComponentWithOnyx />);
        const initialObject = {test: '1'};
        const sameButDifferentObject = {test: '1'};
        let previousComponentValue = null;

        return waitForPromisesToResolve()
            .then(() => onyxMethod(ONYX_KEYS.TEST, {test: '1'}))
            .then(waitForPromisesToResolve)
            .then(() => {
                // The value passed to the component initially should serialize to the same string value (a.k.a. deep equal) as the initial object
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toStrictEqual(initialObject);
                previousComponentValue = newComponentValue;
            })
            // eslint-disable-next-line arrow-body-style
            .then(() => {
                // If the object value does not change when calling set() (even though the reference has changed) then the component will reference the same value as before
                return onyxMethod(ONYX_KEYS.TEST, sameButDifferentObject);
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toBe(previousComponentValue);
                expect(newComponentValue).toStrictEqual(initialObject);

                // If the object value changes even though the reference has not changed the component reference should still change as well
                previousComponentValue = newComponentValue;
                previousComponentValue.test = '2';
                return onyxMethod(ONYX_KEYS.TEST, previousComponentValue);
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toStrictEqual({test: '2'});
                expect(newComponentValue).not.toBe(previousComponentValue);
            });
    }
    it('subscribe to an object and the object changes because Onyx.set() was called for a non-collection key', () => {
        testNonCollectionKey(Onyx.set);
    });

    it('subscribe to an object and the object changes because Onyx.merge() was called for a non-collection key', () => {
        testNonCollectionKey(Onyx.merge);
    });

    function testCollectionSubscriber(onyxMethod) {
        const TestComponentWithOnyx = withOnyx({
            testValue: {
                key: ONYX_KEYS.COLLECTION.TEST,
            },
        })(View);

        const result = render(<TestComponentWithOnyx />);
        const initialObject = {test_1: {test: '1'}};
        const sameButDifferentObject = {test_1: {test: '1'}};
        const key = `${ONYX_KEYS.COLLECTION.TEST}1`;
        let previousComponentValue = null;

        return waitForPromisesToResolve()
            .then(() => onyxMethod(key, {test: '1'}))
            .then(waitForPromisesToResolve)
            .then(() => {
                // The value passed to the component initially should serialize to the same string value (a.k.a. deep equal) as the initial object
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toStrictEqual(initialObject);
                previousComponentValue = newComponentValue;
            })
            // eslint-disable-next-line arrow-body-style
            .then(() => {
                // If the object value does not change when calling set() (even though the reference has changed) then the component will reference the same value as before
                return onyxMethod(key, sameButDifferentObject);
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toBe(previousComponentValue);
                expect(newComponentValue).toStrictEqual(initialObject);

                // If the object value changes even though the reference has not changed the component reference should still change as well
                previousComponentValue = newComponentValue;
                previousComponentValue.test_1 = {test: '2'};
                return onyxMethod(key, previousComponentValue.test_1);
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toStrictEqual({test_1: {test: '2'}});
                expect(newComponentValue).not.toBe(previousComponentValue);
            });
    }

    it('subscribe to a collection key and the collection changes because Onyx.set() was called for a collection member key', () => {
        testCollectionSubscriber(Onyx.set);
    });

    it('subscribe to a collection key and the collection changes because Onyx.merge() was called for a collection member key', () => {
        testCollectionSubscriber(Onyx.merge);
    });

    it('subscribe to a collection key and the collection changes because Onyx.mergeCollection() was called', () => {
        const TestComponentWithOnyx = withOnyx({
            testValue: {
                key: ONYX_KEYS.COLLECTION.TEST,
            },
        })(View);

        const result = render(<TestComponentWithOnyx />);
        const initialObject = {test_1: {test: '1'}};
        const sameButDifferentObject = {test_1: {test: '1'}};
        let previousComponentValue = null;

        return waitForPromisesToResolve()
            .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST, {test_1: {test: '1'}}))
            .then(waitForPromisesToResolve)
            .then(() => {
                // The value passed to the component initially should serialize to the same string value (a.k.a. deep equal) as the initial object
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toStrictEqual(initialObject);
                previousComponentValue = newComponentValue;
            })
            // eslint-disable-next-line arrow-body-style
            .then(() => {
                // If the object value does not change when calling (even though the reference has changed) then the component will reference the same value as before
                return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST, sameButDifferentObject);
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toBe(previousComponentValue);
                expect(newComponentValue).toStrictEqual(initialObject);

                // If the object value changes even though the reference has not changed the component reference should still change as well
                previousComponentValue = newComponentValue;
                previousComponentValue.test_1 = {test: '2'};
                return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST, previousComponentValue);
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                const newComponentValue = result.toJSON().props.testValue;
                expect(newComponentValue).toStrictEqual({test_1: {test: '2'}});
                console.log(newComponentValue === previousComponentValue);
                console.log({newComponentValue, previousComponentValue});
                expect(newComponentValue).not.toBe(previousComponentValue);
            });
    });
});
