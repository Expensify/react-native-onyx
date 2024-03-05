/**
 * Synchronous queue that can be used to ensure promise based tasks are run in sequence.
 * Pass to the constructor a function that returns a promise to run the task then add data.
 *
 * @example
 *
 *     const queue = new SyncQueue(({key, val}) => {
 *         return someAsyncProcess(key, val);
 *     });
 *
 *     queue.push({key: 1, val: '1'});
 *     queue.push({key: 2, val: '2'});
 */
export default class SyncQueue {
    /**
     * @param {Function} run - must return a promise
     */
    constructor(run: Function);
    queue: any[];
    isProcessing: boolean;
    run: Function;
    /**
     * Stop the queue from being processed and clear out any existing tasks
     */
    abort(): void;
    process(): void;
    /**
     * @param {*} data
     * @returns {Promise}
     */
    push(data: any): Promise<any>;
}
