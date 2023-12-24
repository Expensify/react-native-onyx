/**
 * Determines when the client is ready. We need to wait till the init method is called and the leader message is sent.
 */
declare function isReady(): Promise<void>;

/**
 * Subscribes to the broadcast channel to listen for messages from other tabs, so that
 * all tabs agree on who the leader is, which should always be the last tab to open.
 */
declare function init(): void;

/**
 * Returns a boolean indicating if the current client is the leader.
 */
declare function isClientTheLeader(): boolean;

/**
 * Subscribes to when the client changes.
 */
declare function subscribeToClientChange(callback: () => {}): void;

export {isReady, init, isClientTheLeader, subscribeToClientChange};
