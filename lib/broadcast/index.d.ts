/**
 * Sends a message to the broadcast channel.
 */
declare function sendMessage(message: string): void;

/**
 * Subscribes to the broadcast channel. Every time a new message
 * is received, the callback is called.
 */
declare function subscribe(callback: () => {}): void;

/**
 * Disconnects from the broadcast channel.
 */
declare function disconnect(): void;

export {sendMessage, subscribe, disconnect};
