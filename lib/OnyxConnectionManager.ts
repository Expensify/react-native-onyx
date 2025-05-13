import bindAll from 'lodash/bindAll';
import Logger from './Logger';
import type {ConnectOptions} from './Onyx';
import OnyxUtils from './OnyxUtils';
import * as Str from './Str';
import type {CollectionConnectCallback, DefaultConnectCallback, DefaultConnectOptions, OnyxKey, OnyxValue} from './types';
import utils from './utils';
import cache from './OnyxCache';

type ConnectCallback = DefaultConnectCallback<OnyxKey> | CollectionConnectCallback<OnyxKey>;

/**
 * Represents the connection's metadata that contains the necessary properties
 * to handle that connection.
 */
type ConnectionMetadata = {
    /**
     * The subscription ID returned by `OnyxUtils.subscribeToKey()` that is associated to this connection.
     */
    subscriptionID: number;

    /**
     * The Onyx key associated to this connection.
     */
    onyxKey: OnyxKey;

    /**
     * Whether the first connection's callback was fired or not.
     */
    isConnectionMade: boolean;

    /**
     * A map of the subscriber's callbacks associated to this connection.
     */
    callbacks: Map<string, ConnectCallback>;

    /**
     * The last callback value returned by `OnyxUtils.subscribeToKey()`'s callback.
     */
    cachedCallbackValue?: OnyxValue<OnyxKey>;

    /**
     * The last callback key returned by `OnyxUtils.subscribeToKey()`'s callback.
     */
    cachedCallbackKey?: OnyxKey;

    /**
     * The value that triggered the last update
     */
    sourceValue?: OnyxValue<OnyxKey>;

    /**
     * Whether the subscriber is waiting for the collection callback to be fired.
     */
    waitForCollectionCallback?: boolean;
};

/**
 * Represents the connection object returned by `Onyx.connect()`.
 */
type Connection = {
    /**
     * The ID used to identify this particular connection.
     */
    id: string;

    /**
     * The ID of the subscriber's callback that is associated to this connection.
     */
    callbackID: string;
};

/**
 * Manages Onyx connections of `Onyx.connect()`, `useOnyx()` and `withOnyx()` subscribers.
 */
class OnyxConnectionManager {
    /**
     * A map where the key is the connection ID generated inside `connect()` and the value is the metadata of that connection.
     */
    private connectionsMap: Map<string, ConnectionMetadata>;

    /**
     * Stores the last generated callback ID which will be incremented when making a new connection.
     */
    private lastCallbackID: number;

    /**
     * Stores the last generated session ID for the connection manager. The current session ID
     * is appended to the connection IDs and it's used to create new different connections for the same key
     * when `refreshSessionID()` is called.
     *
     * When calling `Onyx.clear()` after a logout operation some connections might remain active as they
     * aren't tied to the React's lifecycle e.g. `Onyx.connect()` usage, causing infinite loading state issues to new `useOnyx()` subscribers
     * that are connecting to the same key as we didn't populate the cache again because we are still reusing such connections.
     *
     * To elimitate this problem, the session ID must be refreshed during the `Onyx.clear()` call (by using `refreshSessionID()`)
     * in order to create fresh connections when new subscribers connect to the same keys again, allowing them
     * to use the cache system correctly and avoid the mentioned issues in `useOnyx()`.
     */
    private sessionID: string;

    constructor() {
        this.connectionsMap = new Map();
        this.lastCallbackID = 0;
        this.sessionID = Str.guid();

        // Binds all public methods to prevent problems with `this`.
        bindAll(this, 'generateConnectionID', 'fireCallbacks', 'connect', 'disconnect', 'disconnectAll', 'refreshSessionID', 'addToEvictionBlockList', 'removeFromEvictionBlockList');
    }

    /**
     * Generates a connection ID based on the `connectOptions` object passed to the function.
     *
     * The properties used to generate the ID are handpicked for performance reasons and
     * according to their purpose and effect they produce in the Onyx connection.
     */
    private generateConnectionID<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): string {
        const {key, initWithStoredValues, reuseConnection, waitForCollectionCallback} = connectOptions;

        // The current session ID is appended to the connection ID so we can have different connections
        // after an `Onyx.clear()` operation.
        let suffix = `,sessionID=${this.sessionID}`;

        // We will generate a unique ID in any of the following situations:
        // - `reuseConnection` is `false`. That means the subscriber explicitly wants the connection to not be reused.
        // - `initWithStoredValues` is `false`. This flag changes the subscription flow when set to `false`, so the connection can't be reused.
        // - `key` is a collection key AND `waitForCollectionCallback` is `undefined/false`. This combination needs a new connection at every subscription
        //   in order to send all the collection entries, so the connection can't be reused.
        // - `withOnyxInstance` is defined inside `connectOptions`. That means the subscriber is a `withOnyx` HOC and therefore doesn't support connection reuse.
        if (
            reuseConnection === false ||
            initWithStoredValues === false ||
            (!utils.hasWithOnyxInstance(connectOptions) && OnyxUtils.isCollectionKey(key) && (waitForCollectionCallback === undefined || waitForCollectionCallback === false)) ||
            utils.hasWithOnyxInstance(connectOptions)
        ) {
            suffix += `,uniqueID=${Str.guid()}`;
        }

        return `onyxKey=${key},initWithStoredValues=${initWithStoredValues ?? true},waitForCollectionCallback=${waitForCollectionCallback ?? false}${suffix}`;
    }

    /**
     * Fires all the subscribers callbacks associated with that connection ID.
     */
    private fireCallbacks(connectionID: string): void {
        const connection = this.connectionsMap.get(connectionID);

        connection?.callbacks.forEach((callback) => {
            if (connection.waitForCollectionCallback) {
                (callback as CollectionConnectCallback<OnyxKey>)(connection.cachedCallbackValue as Record<string, unknown>, connection.cachedCallbackKey as OnyxKey, connection.sourceValue);
            } else {
                (callback as DefaultConnectCallback<OnyxKey>)(connection.cachedCallbackValue, connection.cachedCallbackKey as OnyxKey);
            }
        });
    }

    /**
     * Connects to an Onyx key given the options passed and listens to its changes.
     *
     * @param connectOptions The options object that will define the behavior of the connection.
     * @returns The connection object to use when calling `disconnect()`.
     */
    connect<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): Connection {
        const connectionID = this.generateConnectionID(connectOptions);
        let connectionMetadata = this.connectionsMap.get(connectionID);
        let subscriptionID: number | undefined;

        const callbackID = String(this.lastCallbackID++);

        // If there is no connection yet for that connection ID, we create a new one.
        if (!connectionMetadata) {
            let callback: ConnectCallback | undefined;

            // If the subscriber is a `withOnyx` HOC we don't define `callback` as the HOC will use
            // its own logic to handle the data.
            if (!utils.hasWithOnyxInstance(connectOptions)) {
                callback = (value, key, sourceValue) => {
                    const createdConnection = this.connectionsMap.get(connectionID);
                    if (createdConnection) {
                        // We signal that the first connection was made and now any new subscribers
                        // can fire their callbacks immediately with the cached value when connecting.
                        createdConnection.isConnectionMade = true;
                        createdConnection.cachedCallbackValue = value;
                        createdConnection.cachedCallbackKey = key;
                        createdConnection.sourceValue = sourceValue;
                        this.fireCallbacks(connectionID);
                    }
                };
            }

            subscriptionID = OnyxUtils.subscribeToKey({
                ...connectOptions,
                callback: callback as DefaultConnectCallback<TKey>,
            });

            connectionMetadata = {
                subscriptionID,
                onyxKey: connectOptions.key,
                isConnectionMade: false,
                callbacks: new Map(),
                waitForCollectionCallback: connectOptions.waitForCollectionCallback,
            };

            this.connectionsMap.set(connectionID, connectionMetadata);
        }

        // We add the subscriber's callback to the list of callbacks associated with this connection.
        if (connectOptions.callback) {
            connectionMetadata.callbacks.set(callbackID, connectOptions.callback as ConnectCallback);
        }

        // If the first connection is already made we want any new subscribers to receive the cached callback value immediately.
        if (connectionMetadata.isConnectionMade) {
            // Defer the callback execution to the next tick of the event loop.
            // This ensures that the current execution flow completes and the result connection object is available when the callback fires.
            Promise.resolve().then(() => {
                (connectOptions as DefaultConnectOptions<OnyxKey>).callback?.(connectionMetadata.cachedCallbackValue, connectionMetadata.cachedCallbackKey as OnyxKey);
            });
        }

        return {id: connectionID, callbackID};
    }

    /**
     * Disconnects and removes the listener from the Onyx key.
     *
     * @param connection Connection object returned by calling `connect()`.
     */
    disconnect(connection: Connection): void {
        if (!connection) {
            Logger.logInfo(`[ConnectionManager] Attempted to disconnect passing an undefined connection object.`);
            return;
        }

        const connectionMetadata = this.connectionsMap.get(connection.id);
        if (!connectionMetadata) {
            Logger.logInfo(`[ConnectionManager] Attempted to disconnect but no connection was found.`);
            return;
        }

        // Removes the callback from the connection's callbacks map.
        connectionMetadata.callbacks.delete(connection.callbackID);

        // If the connection's callbacks map is empty we can safely unsubscribe from the Onyx key.
        if (connectionMetadata.callbacks.size === 0) {
            OnyxUtils.unsubscribeFromKey(connectionMetadata.subscriptionID);
            this.removeFromEvictionBlockList(connection);

            this.connectionsMap.delete(connection.id);
        }
    }

    /**
     * Disconnect all subscribers from Onyx.
     */
    disconnectAll(): void {
        this.connectionsMap.forEach((connectionMetadata, connectionID) => {
            OnyxUtils.unsubscribeFromKey(connectionMetadata.subscriptionID);
            connectionMetadata.callbacks.forEach((_, callbackID) => {
                this.removeFromEvictionBlockList({id: connectionID, callbackID});
            });
        });

        this.connectionsMap.clear();
    }

    /**
     * Refreshes the connection manager's session ID.
     */
    refreshSessionID(): void {
        this.sessionID = Str.guid();
    }

    /**
     * Adds the connection to the eviction block list. Connections added to this list can never be evicted.
     * */
    addToEvictionBlockList(connection: Connection): void {
        if (!connection) {
            Logger.logInfo(`[ConnectionManager] Attempted to add connection to eviction block list passing an undefined connection object.`);
            return;
        }

        const connectionMetadata = this.connectionsMap.get(connection.id);
        if (!connectionMetadata) {
            Logger.logInfo(`[ConnectionManager] Attempted to add connection to eviction block list but no connection was found.`);
            return;
        }

        const evictionBlocklist = cache.getEvictionBlocklist();
        if (!evictionBlocklist[connectionMetadata.onyxKey]) {
            evictionBlocklist[connectionMetadata.onyxKey] = [];
        }

        evictionBlocklist[connectionMetadata.onyxKey]?.push(`${connection.id}_${connection.callbackID}`);
    }

    /**
     * Removes a connection previously added to this list
     * which will enable it to be evicted again.
     */
    removeFromEvictionBlockList(connection: Connection): void {
        if (!connection) {
            Logger.logInfo(`[ConnectionManager] Attempted to remove connection from eviction block list passing an undefined connection object.`);
            return;
        }

        const connectionMetadata = this.connectionsMap.get(connection.id);
        if (!connectionMetadata) {
            Logger.logInfo(`[ConnectionManager] Attempted to remove connection from eviction block list but no connection was found.`);
            return;
        }

        const evictionBlocklist = cache.getEvictionBlocklist();
        evictionBlocklist[connectionMetadata.onyxKey] =
            evictionBlocklist[connectionMetadata.onyxKey]?.filter((evictionKey) => evictionKey !== `${connection.id}_${connection.callbackID}`) ?? [];

        // Remove the key if there are no more subscribers.
        if (evictionBlocklist[connectionMetadata.onyxKey]?.length === 0) {
            delete evictionBlocklist[connectionMetadata.onyxKey];
        }
    }
}

const connectionManager = new OnyxConnectionManager();

export default connectionManager;

export type {Connection};
