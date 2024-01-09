const BROADCAST_ONYX = 'BROADCAST_ONYX';

const subscriptions = [];
const channel = new BroadcastChannel(BROADCAST_ONYX);

/**
 * Sends a message to the broadcast channel.
 * @param {String} message
 */
function sendMessage(message) {
    channel.postMessage(message);
}

/**
 * Subscribes to the broadcast channel. Every time a new message
 * is received, the callback is called.
 * @param {Function} callback
 */
function subscribe(callback) {
    subscriptions.push(callback);
    channel.onmessage = (message) => {
        subscriptions.forEach((c) => c(message));
    };
}

/**
 * Disconnects from the broadcast channel.
 */
function disconnect() {
    channel.close();
}

export {sendMessage, subscribe, disconnect};
