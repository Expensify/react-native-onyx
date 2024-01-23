/**
 * For native devices, there will never be more than one
 * client running at a time, so this lib is a big no-op
 */

function sendMessage() {}

function subscribe() {}

function disconnect() {}

export {sendMessage, subscribe, disconnect};
