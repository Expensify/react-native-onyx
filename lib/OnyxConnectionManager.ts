import bindAll from 'lodash/bindAll';
import type {ConnectOptions} from './Onyx';
import Onyx from './Onyx';
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

class OnyxConnectionManager {
    private connectionsMap: Map<string, Connection>;

    private lastCallbackID: number;

    constructor() {
        this.connectionsMap = new Map();
        this.lastCallbackID = 0;

        bindAll(this, 'fireCallbacks', 'connectionMapKey', 'connect', 'disconnect', 'disconnectAll');
    }

    private connectionMapKey<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): string {
        return `key=${connectOptions.key},initWithStoredValues=${connectOptions.initWithStoredValues ?? true},waitForCollectionCallback=${connectOptions.waitForCollectionCallback ?? false}`;
    }

    private fireCallbacks(mapKey: string): void {
        const connection = this.connectionsMap.get(mapKey);

        connection?.callbacks.forEach((callback) => {
            callback(connection.cachedCallbackValue, connection.cachedCallbackKey as OnyxKey);
        });
    }

    connect<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): [number, string, string] {
        const mapKey = this.connectionMapKey(connectOptions);
        let connection = this.connectionsMap.get(mapKey);
        let connectionID: number | undefined;

        const callbackID = String(this.lastCallbackID++);

        if (!connection) {
            connectionID = Onyx.connect({
                ...(connectOptions as DefaultConnectOptions<OnyxKey>),
                callback: (value, key) => {
                    const createdConnection = this.connectionsMap.get(mapKey);
                    if (createdConnection) {
                        createdConnection.isConnectionMade = true;
                        createdConnection.cachedCallbackValue = value;
                        createdConnection.cachedCallbackKey = key;

                        this.fireCallbacks(mapKey);
                    }
                },
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

        return [connection.id, mapKey, callbackID];
    }

    disconnect(mapKey: string, callbackID: string): void {
        const connection = this.connectionsMap.get(mapKey);

        if (!connection) {
            return;
        }

        connection.callbacks.delete(callbackID);

        if (connection.callbacks.size === 0) {
            Onyx.disconnect(connection.id);
            this.connectionsMap.delete(mapKey);
        }
    }

    disconnectAll(): void {
        Array.from(this.connectionsMap.values()).forEach((connection) => {
            Onyx.disconnect(connection.id);
        });

        this.connectionsMap.clear();
    }
}

const connectionManager = new OnyxConnectionManager();

export default connectionManager;
