import bindAll from 'lodash/bindAll';
import * as Logger from './Logger';
import type {ConnectOptions} from './Onyx';
import OnyxUtils from './OnyxUtils';
import * as Str from './Str';
import type {DefaultConnectCallback, DefaultConnectOptions, OnyxKey, OnyxValue} from './types';

type ConnectCallback = DefaultConnectCallback<OnyxKey>;

type Connection = {
    subscriptionID: number;
    onyxKey: OnyxKey;
    isConnectionMade: boolean;
    callbacks: Map<string, ConnectCallback>;
    cachedCallbackValue?: OnyxValue<OnyxKey>;
    cachedCallbackKey?: OnyxKey;
};

type ConnectionMetadata = {
    id: string;
    callbackID: string;
    subscriptionID: number;
};

class OnyxConnectionManager {
    private connectionsMap: Map<string, Connection>;

    private lastCallbackID: number;

    constructor() {
        this.connectionsMap = new Map();
        this.lastCallbackID = 0;

        bindAll(this, 'fireCallbacks', 'connectionMapKey', 'connect', 'disconnect', 'disconnectAll', 'addToEvictionBlockList', 'removeFromEvictionBlockList');
    }

    private connectionMapKey<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): string {
        let suffix = '';

        if (connectOptions.reuseConnection === false || 'withOnyxInstance' in connectOptions) {
            suffix += `,uniqueID=${Str.guid()}`;
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

    connect<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): ConnectionMetadata {
        const mapKey = this.connectionMapKey(connectOptions);
        let connection = this.connectionsMap.get(mapKey);
        let subscriptionID: number | undefined;

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

            subscriptionID = OnyxUtils.connectToKey({
                ...(connectOptions as DefaultConnectOptions<OnyxKey>),
                callback,
            });

            connection = {
                subscriptionID,
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
            Promise.resolve().then(() => {
                (connectOptions as DefaultConnectOptions<OnyxKey>).callback?.(connection.cachedCallbackValue, connection.cachedCallbackKey as OnyxKey);
            });
        }

        return {id: mapKey, callbackID, subscriptionID: connection.subscriptionID};
    }

    /**
     * Remove the listener for a react component
     * @example
     * Onyx.disconnect(connection);
     *
     * @param connection connection metadata object returned by call to `Onyx.connect()`
     */
    disconnect(connectionMetadada: ConnectionMetadata): void {
        if (!connectionMetadada) {
            Logger.logAlert(`[ConnectionManager] Attempted to disconnect passing an undefined metadata object.`);
            return;
        }

        const connection = this.connectionsMap.get(connectionMetadada.id);
        if (!connection) {
            return;
        }

        connection.callbacks.delete(connectionMetadada.callbackID);

        if (connection.callbacks.size === 0) {
            OnyxUtils.disconnectFromKey(connection.subscriptionID);
            this.removeFromEvictionBlockList(connectionMetadada);

            this.connectionsMap.delete(connectionMetadada.id);
        }
    }

    disconnectAll(): void {
        Array.from(this.connectionsMap.entries()).forEach(([connectionID, connection]) => {
            OnyxUtils.disconnectFromKey(connection.subscriptionID);
            Array.from(connection.callbacks.keys()).forEach((callbackID) => {
                this.removeFromEvictionBlockList({id: connectionID, callbackID, subscriptionID: connection.subscriptionID});
            });
        });

        this.connectionsMap.clear();
    }

    /** Keys added to this list can never be deleted. */
    addToEvictionBlockList(connectionMetadada: ConnectionMetadata): void {
        const connection = this.connectionsMap.get(connectionMetadada.id);
        if (!connection) {
            return;
        }

        this.removeFromEvictionBlockList(connectionMetadada);

        const evictionBlocklist = OnyxUtils.getEvictionBlocklist();
        if (!evictionBlocklist[connection.onyxKey]) {
            evictionBlocklist[connection.onyxKey] = [];
        }

        evictionBlocklist[connection.onyxKey]?.push(`${connectionMetadada.id}_${connectionMetadada.callbackID}`);
    }

    /**
     * Removes a key previously added to this list
     * which will enable it to be deleted again.
     */
    removeFromEvictionBlockList(connectionMetadada: ConnectionMetadata): void {
        const connection = this.connectionsMap.get(connectionMetadada.id);
        if (!connection) {
            return;
        }

        const evictionBlocklist = OnyxUtils.getEvictionBlocklist();
        evictionBlocklist[connection.onyxKey] =
            evictionBlocklist[connection.onyxKey]?.filter((evictionKey) => evictionKey !== `${connectionMetadada.id}_${connectionMetadada.callbackID}`) ?? [];

        // Remove the key if there are no more subscribers.
        if (evictionBlocklist[connection.onyxKey]?.length === 0) {
            delete evictionBlocklist[connection.onyxKey];
        }
    }
}

const connectionManager = new OnyxConnectionManager();

export default connectionManager;

export type {ConnectionMetadata};
