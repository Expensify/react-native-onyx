import bindAll from 'lodash/bindAll';
import type {ConnectOptions} from './Onyx';
import Onyx from './Onyx';
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

            connectionID = Onyx.connect({
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

    disconnect({key, callbackID}: ConnectionMetadata, shouldRemoveKeyFromEvictionBlocklist?: boolean): void {
        const connection = this.connectionsMap.get(key);

        if (!connection) {
            return;
        }

        connection.callbacks.delete(callbackID);

        if (connection.callbacks.size === 0) {
            Onyx.disconnect(connection.id, shouldRemoveKeyFromEvictionBlocklist ? connection.onyxKey : undefined);
            this.connectionsMap.delete(key);
        }
    }

    disconnectKey(key: string, shouldRemoveKeyFromEvictionBlocklist?: boolean): void {
        const connection = this.connectionsMap.get(key);

        if (!connection) {
            return;
        }

        Onyx.disconnect(connection.id, shouldRemoveKeyFromEvictionBlocklist ? connection.onyxKey : undefined);
        this.connectionsMap.delete(key);
    }

    disconnectAll(shouldRemoveKeysFromEvictionBlocklist?: boolean): void {
        Array.from(this.connectionsMap.values()).forEach((connection) => {
            Onyx.disconnect(connection.id, shouldRemoveKeysFromEvictionBlocklist ? connection.onyxKey : undefined);
        });

        this.connectionsMap.clear();
    }
}

const connectionManager = new OnyxConnectionManager();

export default connectionManager;

export type {ConnectionMetadata};
