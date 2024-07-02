import bindAll from 'lodash/bindAll';
import type {ConnectOptions} from './Onyx';
import OnyxUtils from './OnyxUtils';
import * as Str from './Str';
import type {DefaultConnectCallback, DefaultConnectOptions, OnyxKey, OnyxValue} from './types';

type ConnectCallback = DefaultConnectCallback<OnyxKey>;

type Connection = {
    id: number;
    onyxKey: OnyxKey;
    isConnectionMade: boolean;
    callbacks: Map<string, ConnectCallback>;
    cachedCallbackValue?: OnyxValue<OnyxKey>;
    cachedCallbackKey?: OnyxKey;
};

type ConnectionMetadata = {
    key: string;
    callbackID: string;
    connectionID: number;
};

class OnyxConnectionManager {
    private connectionsMap: Map<string, Connection>;

    private lastCallbackID: number;

    constructor() {
        this.connectionsMap = new Map();
        this.lastCallbackID = 0;

        bindAll(this, 'fireCallbacks', 'connectionMapKey', 'connect', 'disconnect', 'disconnectKey', 'disconnectAll');
    }

    private connectionMapKey<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): string {
        let suffix = '';

        if ('withOnyxInstance' in connectOptions) {
            suffix += `,withOnyxInstance=${Str.guid()}`;
        }

        return `key=${connectOptions.key},initWithStoredValues=${connectOptions.initWithStoredValues ?? true},waitForCollectionCallback=${
            connectOptions.waitForCollectionCallback ?? false
        }${suffix}`;
    }

    private fireCallbacks(mapKey: string): void {
        const connection = this.connectionsMap.get(mapKey);

        connection?.callbacks.forEach((callback) => {
            callback(connection.cachedCallbackValue, connection.cachedCallbackKey as OnyxKey);
        });
    }

    /**
     * Subscribes a react component's state directly to a store key
     *
     * @example
     * const connection = Onyx.connect({
     *     key: ONYXKEYS.SESSION,
     *     callback: onSessionChange,
     * });
     *
     * @param mapping the mapping information to connect Onyx to the components state
     * @param mapping.key ONYXKEY to subscribe to
     * @param [mapping.statePropertyName] the name of the property in the state to connect the data to
     * @param [mapping.withOnyxInstance] whose setState() method will be called with any changed data
     *      This is used by React components to connect to Onyx
     * @param [mapping.callback] a method that will be called with changed data
     *      This is used by any non-React code to connect to Onyx
     * @param [mapping.initWithStoredValues] If set to false, then no data will be prefilled into the
     *  component
     * @param [mapping.waitForCollectionCallback] If set to true, it will return the entire collection to the callback as a single object
     * @param [mapping.selector] THIS PARAM IS ONLY USED WITH withOnyx(). If included, this will be used to subscribe to a subset of an Onyx key's data.
     *       The sourceData and withOnyx state are passed to the selector and should return the simplified data. Using this setting on `withOnyx` can have very positive
     *       performance benefits because the component will only re-render when the subset of data changes. Otherwise, any change of data on any property would normally
     *       cause the component to re-render (and that can be expensive from a performance standpoint).
     * @param [mapping.initialValue] THIS PARAM IS ONLY USED WITH withOnyx().
     * If included, this will be passed to the component so that something can be rendered while data is being fetched from the DB.
     * Note that it will not cause the component to have the loading prop set to true.
     * @returns a connection metadata object to use when calling `Onyx.disconnect()`
     */
    connect<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): ConnectionMetadata {
        const mapKey = this.connectionMapKey(connectOptions);
        let connection = this.connectionsMap.get(mapKey);
        let connectionID: number | undefined;

        const callbackID = String(this.lastCallbackID++);

        if (!connection) {
            let callback: ConnectCallback | undefined;

            if (!('withOnyxInstance' in connectOptions)) {
                callback = (value, key) => {
                    const createdConnection = this.connectionsMap.get(mapKey);
                    if (createdConnection) {
                        createdConnection.isConnectionMade = true;
                        createdConnection.cachedCallbackValue = value;
                        createdConnection.cachedCallbackKey = key;

                        this.fireCallbacks(mapKey);
                    }
                };
            }

            connectionID = OnyxUtils.connectToKey({
                ...(connectOptions as DefaultConnectOptions<OnyxKey>),
                callback,
            });

            connection = {
                id: connectionID,
                onyxKey: connectOptions.key,
                isConnectionMade: false,
                callbacks: new Map(),
            };

            this.connectionsMap.set(mapKey, connection);
        }

        if (connectOptions.callback) {
            connection.callbacks.set(callbackID, connectOptions.callback as ConnectCallback);
        }

        if (connection.isConnectionMade) {
            (connectOptions as DefaultConnectOptions<OnyxKey>).callback?.(connection.cachedCallbackValue, connection.cachedCallbackKey as OnyxKey);
        }

        return {key: mapKey, callbackID, connectionID: connection.id};
    }

    /**
     * Remove the listener for a react component
     * @example
     * Onyx.disconnectFromKey(connection);
     *
     * @param connection connection metadata object returned by call to `Onyx.connect()`
     */
    disconnect({key, callbackID}: ConnectionMetadata, shouldRemoveKeyFromEvictionBlocklist?: boolean): void {
        const connection = this.connectionsMap.get(key);

        if (!connection) {
            return;
        }

        connection.callbacks.delete(callbackID);

        if (connection.callbacks.size === 0) {
            OnyxUtils.disconnectFromKey(connection.id, shouldRemoveKeyFromEvictionBlocklist ? connection.onyxKey : undefined);
            this.connectionsMap.delete(key);
        }
    }

    disconnectKey(key: string, shouldRemoveKeyFromEvictionBlocklist?: boolean): void {
        const connection = this.connectionsMap.get(key);

        if (!connection) {
            return;
        }

        OnyxUtils.disconnectFromKey(connection.id, shouldRemoveKeyFromEvictionBlocklist ? connection.onyxKey : undefined);
        this.connectionsMap.delete(key);
    }

    disconnectAll(shouldRemoveKeysFromEvictionBlocklist?: boolean): void {
        Array.from(this.connectionsMap.values()).forEach((connection) => {
            OnyxUtils.disconnectFromKey(connection.id, shouldRemoveKeysFromEvictionBlocklist ? connection.onyxKey : undefined);
        });

        this.connectionsMap.clear();
    }
}

const connectionManager = new OnyxConnectionManager();

export default connectionManager;

export type {ConnectionMetadata};
