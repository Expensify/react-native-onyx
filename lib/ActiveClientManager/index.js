/**
 * When you have many tabs in one browser, the data of Onyx is shared between all of them. Since we persist write requests in Onyx, we need to ensure that
 * only one tab is processing those saved requests or we would be duplicating data (or creating errors).
 * This file ensures exactly that by tracking all the clientIDs connected, storing the most recent one last and it considers that last clientID the "leader".
 */

import * as Str from '../Str';
import * as Broadcast from '../broadcast';

const NEW_LEADER_MESSAGE = 'NEW_LEADER';
const REMOVED_LEADER_MESSAGE = 'REMOVE_LEADER';

const clientID = Str.guid();
const subscribers = [];
let timestamp = null;

let activeClientID = null;
let setIsReady = () => {};
const isReadyPromise = new Promise((resolve) => {
    setIsReady = resolve;
});

/**
 * Determines when the client is ready. We need to wait both till we saved our ID in onyx AND the init method was called
 * @returns {Promise}
 */
function isReady() {
    return isReadyPromise;
}

/**
 * Returns a boolean indicating if the current client is the leader.
 *
 * @returns {Boolean}
 */
function isClientTheLeader() {
    return activeClientID === clientID;
}

/**
 * Subscribes to when the client changes.
 * @param {Function} callback
 */
function subscribeToClientChange(callback) {
    subscribers.push(callback);
}

/**
 * Subscribe to the broadcast channel to listen for messages from other tabs, so that
 * all tabs agree on who the leader is, which should always be the last tab to open.
 */
function init() {
    Broadcast.subscribe((message) => {
        switch (message.data.type) {
            case NEW_LEADER_MESSAGE: {
                // Only update the active leader if the message received was from another
                // tab that initialized after the current one; if the timestamps are the
                // same, it uses the client ID to tie-break
                const isTimestampEqual = timestamp === message.data.timestamp;
                const isTimestampNewer = timestamp > message.data.timestamp;
                if (isClientTheLeader() && (isTimestampNewer || (isTimestampEqual && clientID > message.data.clientID))) {
                    return;
                }
                activeClientID = message.data.clientID;

                subscribers.forEach((callback) => callback());
                break;
            }
            case REMOVED_LEADER_MESSAGE:
                activeClientID = clientID;
                timestamp = Date.now();
                Broadcast.sendMessage({type: NEW_LEADER_MESSAGE, clientID, timestamp});
                subscribers.forEach((callback) => callback());
                break;
            default:
                break;
        }
    });

    activeClientID = clientID;
    timestamp = Date.now();

    Broadcast.sendMessage({type: NEW_LEADER_MESSAGE, clientID, timestamp});
    setIsReady();

    window.addEventListener('beforeunload', () => {
        if (!isClientTheLeader()) {
            return;
        }
        Broadcast.sendMessage({type: REMOVED_LEADER_MESSAGE, clientID});
    });
}

export {isClientTheLeader, init, isReady, subscribeToClientChange};
