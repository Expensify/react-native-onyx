type DevtoolsOptions = {
    maxAge?: number;
    name?: string;
    postTimelineUpdate?: () => void;
    preAction?: () => void;
    logTrace?: boolean;
    remote?: boolean;
};

type DevtoolsSubscriber = (message: {type: string; payload: unknown; state: string}) => void;

type DevtoolsConnection = {
    send(data: Record<string, unknown>, state: Record<string, unknown>): void;
    init(state: Record<string, unknown>): void;
    unsubscribe(): void;
    subscribe(cb: DevtoolsSubscriber): () => void;
};

type ReduxDevtools = {
    connect(options?: DevtoolsOptions): DevtoolsConnection;
};

/**
 * Type definition for DevTools instance
 */
type IDevTools = {
    registerAction(type: string, payload: unknown, stateChanges?: Record<string, unknown> | null): void;
    initState(initialState?: Record<string, unknown>): void;
    clearState(keysToPreserve?: string[]): void;
};

export type {DevtoolsOptions, DevtoolsSubscriber, DevtoolsConnection, ReduxDevtools, IDevTools};
