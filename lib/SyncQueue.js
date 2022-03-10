export default class SyncQueue {
    constructor(run) {
        this.queue = [];
        this.isProcessing = false;
        this.run = run;
    }

    process() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        const {data, resolve, reject} = this.queue.shift();
        this.run(data)
            .then(resolve)
            .catch(reject)
            .finally(() => {
                this.isProcessing = false;
                this.process();
            });
    }

    /**
     * @param {*} data
     * @returns {Promise}
     */
    push(data) {
        return new Promise((resolve, reject) => {
            this.queue.push({resolve, reject, data});
            this.process();
        });
    }
}
