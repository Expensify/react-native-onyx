import connectionManager from '../../lib/OnyxConnectionManager';

export type ConnectionMetadataForTest = {
    subscriptionID: number;
};

type OnyxConnectionManagerTestHarness = {
    connectionsMap: Map<string, ConnectionMetadataForTest>;
    generateConnectionID: (options: {key: string}) => string;
    sessionID: string;
    fireCallbacks: (connectionID: string) => void;
};

export function getOnyxConnectionManagerTestHarness(): OnyxConnectionManagerTestHarness {
    return connectionManager as OnyxConnectionManagerTestHarness;
}
