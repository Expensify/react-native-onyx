import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
    initialKeyStates: {
        [ONYX_KEYS.OTHER_TEST]: 42,
    },
});

describe('Onyx property subscribers', () => {
    let connectionID;

    afterEach(() => {
        Onyx.disconnect(connectionID);
        return Onyx.clear();
    });

    it('Triggers a connection callback when the property changes', () => {
        const connectionCallbackMock = jest.fn();

        return waitForPromisesToResolve()

            // Given that onyx contains an object with two properties
            .then(() => Onyx.set(ONYX_KEYS.TEST_KEY, {a: 'one', b: 'two'}))

            // When we connect to that key and specific a selector path
            .then(() => {
                connectionID = Onyx.connect({
                    key: ONYX_KEYS.TEST_KEY,
                    selector: '.a',
                    callback: connectionCallbackMock,
                });
            })

            .then(() => {
                // Then the callback should be called once
                expect(connectionCallbackMock).toHaveBeenCalledTimes(1);

                // with the value of just the .a value
                expect(connectionCallbackMock).toHaveBeenCalledWith('one');
            })

            // When the .a property changes
            .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {a: 'two'}))
            .then(() => {
                // Then the callback should be called one more time
                expect(connectionCallbackMock).toHaveBeenCalledTimes(2);

                // Then the callback should be called with the value of just the .a value
                expect(connectionCallbackMock).toHaveBeenCalledWith('two');
            })

            // When the .b property, which we aren't listening to, changes
            .then(() => Onyx.merge(ONYX_KEYS.TEST_KEY, {b: 'three'}))
            .then(() => {
                // Then the callback should still only have been called once
                expect(connectionCallbackMock).toHaveBeenCalledTimes(1);
            });
    });
});
