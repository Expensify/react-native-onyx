import Onyx from '../../lib';
import PendingWrites from '../../lib/PendingWrites';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYXKEYS = {
    TEST_KEY: 'test',
    OTHER_TEST: 'otherTest',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

Onyx.init({keys: ONYXKEYS});

/** A write whose settling we control, so a notification can be observed before and after it lands. */
function createPendingWrite() {
    let settle: (() => void) | undefined;
    let reject: (() => void) | undefined;
    const promise = new Promise<void>((resolve, rejectPromise) => {
        settle = resolve;
        reject = () => rejectPromise(new Error('write failed'));
    });
    promise.catch(() => undefined);
    return {promise, settle, reject};
}

describe('PendingWrites', () => {
    beforeEach(() => {
        PendingWrites.clearPendingWrites();
    });

    it('should hold a key notification until that key’s write settles', async () => {
        // Given a tracked write to the key we are about to subscribe to
        const notify = jest.fn();
        const write = createPendingWrite();
        PendingWrites.trackPendingWrite(ONYXKEYS.TEST_KEY, write.promise);

        // When a subscriber asks to be notified
        PendingWrites.scheduleInitialSubscriberNotification(ONYXKEYS.TEST_KEY, notify);
        await waitForPromisesToResolve();

        // Then it waits, because the value it would read is about to change
        expect(notify).not.toHaveBeenCalled();

        // And it is notified once the write lands
        write.settle?.();
        await waitForPromisesToResolve();
        expect(notify).toHaveBeenCalledTimes(1);
    });

    it('should notify straight away when the pending write is for another key', async () => {
        // Given a tracked write to an unrelated key
        const notify = jest.fn();
        const write = createPendingWrite();
        PendingWrites.trackPendingWrite(ONYXKEYS.OTHER_TEST, write.promise);

        // When a subscriber to a different key asks to be notified
        PendingWrites.scheduleInitialSubscriberNotification(ONYXKEYS.TEST_KEY, notify);
        await waitForPromisesToResolve();

        // Then the unrelated write never delays it
        expect(notify).toHaveBeenCalledTimes(1);

        write.settle?.();
    });

    it('should hold a collection notification until a member write settles', async () => {
        // Given a tracked write to a member of the collection
        const notify = jest.fn();
        const write = createPendingWrite();
        PendingWrites.trackPendingWrite(`${ONYXKEYS.COLLECTION.TEST_KEY}1`, write.promise);

        // When a subscriber to the collection root asks to be notified
        PendingWrites.scheduleInitialSubscriberNotification(ONYXKEYS.COLLECTION.TEST_KEY, notify);
        await waitForPromisesToResolve();

        // Then it waits, since the member write changes what the collection delivers
        expect(notify).not.toHaveBeenCalled();

        write.settle?.();
        await waitForPromisesToResolve();
        expect(notify).toHaveBeenCalledTimes(1);
    });

    it('should hold every key’s notification until a global write settles', async () => {
        // Given a tracked global write, as Onyx.clear() registers
        const notify = jest.fn();
        const write = createPendingWrite();
        PendingWrites.trackPendingGlobalWrite(write.promise);

        // When subscribers to unrelated keys ask to be notified
        PendingWrites.scheduleInitialSubscriberNotification(ONYXKEYS.TEST_KEY, notify);
        PendingWrites.scheduleInitialSubscriberNotification(ONYXKEYS.OTHER_TEST, notify);
        await waitForPromisesToResolve();

        // Then both wait, since a global write changes every key
        expect(notify).not.toHaveBeenCalled();

        write.settle?.();
        await waitForPromisesToResolve();
        expect(notify).toHaveBeenCalledTimes(2);
    });

    it('should stop tracking a write once it has settled', async () => {
        // Given a write that has already settled
        const write = createPendingWrite();
        PendingWrites.trackPendingWrite(ONYXKEYS.TEST_KEY, write.promise);
        write.settle?.();
        await waitForPromisesToResolve();

        // When a subscriber asks to be notified afterwards
        const notify = jest.fn();
        PendingWrites.scheduleInitialSubscriberNotification(ONYXKEYS.TEST_KEY, notify);
        await waitForPromisesToResolve();

        // Then nothing is left to wait for
        expect(notify).toHaveBeenCalledTimes(1);
    });

    it('should release a notification when the write it waits on fails', async () => {
        // Given a tracked write that will reject
        const notify = jest.fn();
        const write = createPendingWrite();
        PendingWrites.trackPendingWrite(ONYXKEYS.TEST_KEY, write.promise);
        PendingWrites.scheduleInitialSubscriberNotification(ONYXKEYS.TEST_KEY, notify);
        await waitForPromisesToResolve();
        expect(notify).not.toHaveBeenCalled();

        // When the write fails
        write.reject?.();
        await waitForPromisesToResolve();

        // Then the subscriber is still notified, rather than waiting forever on a failed write
        expect(notify).toHaveBeenCalledTimes(1);
    });
});
