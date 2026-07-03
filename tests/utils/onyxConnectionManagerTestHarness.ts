import connectionManager from "../../lib/OnyxConnectionManager";
import type { ConnectOptions } from "../../lib/Onyx";
import type { OnyxKey } from "../../lib/types";

export type ConnectionMetadataForTest = {
  subscriptionID: number;
};

type OnyxConnectionManagerTestHarness = {
  connectionsMap: Map<string, ConnectionMetadataForTest>;
  generateConnectionID: <TKey extends OnyxKey>(
    connectOptions: ConnectOptions<TKey>,
  ) => string;
  sessionID: string;
  fireCallbacks: (connectionID: string) => void;
};

export function getOnyxConnectionManagerTestHarness(): OnyxConnectionManagerTestHarness {
  return connectionManager as unknown as OnyxConnectionManagerTestHarness;
}
