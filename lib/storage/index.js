import {Platform} from 'react-native';

const Storage = Platform.select({
    default: () => require('./WebStorage').default,
    native: () => require('./NativeStorage').default,
})();

class SynchronousWriteQueue {
    constructor() {
        this.isWriting = false;
        this.queue = [];
    }

    push(item) {
        this.queue.push(item);
        this.process();
    }

    process() {
        if (this.isWriting) {
            return;
        }

        this.isWriting = true;
        const {
            key, value, resolve, reject,
        } = this.queue.shift();
        Storage.setItem(key, value)
            .then(resolve)
            .then(() => {
                this.isWriting = false;
                this.process();
            })
            .catch(reject);
    }
}

const pairQueue = new SynchronousWriteQueue();

const StorageWithWriteQueue = {
    ...Storage,
    setItem(key, value) {
        return new Promise((resolve, reject) => {
            pairQueue.push({
                key,
                value,
                resolve,
                reject
            });
        });
    },
};

export default StorageWithWriteQueue;
