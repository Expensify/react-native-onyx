/**
 * For native devices, there will never be more than one
 * client running at a time, so this lib is a big no-op
 */

function isReady() {
    return Promise.resolve();
}

function isClientTheLeader() {
    return true;
}

function init() {}

function subscribeToClientChange() {}

export {isClientTheLeader, init, isReady, subscribeToClientChange};
