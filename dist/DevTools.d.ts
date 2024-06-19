type DevtoolsOptions = {
    maxAge?: number;
    name?: string;
    postTimelineUpdate?: () => void;
    preAction?: () => void;
    logTrace?: boolean;
    remote?: boolean;
};
type DevtoolsSubscriber = (message: {
    type: string;
    payload: unknown;
    state: string;
}) => void;
type DevtoolsConnection = {
    send(data: Record<string, unknown>, state: Record<string, unknown>): void;
    init(state: Record<string, unknown>): void;
    unsubscribe(): void;
    subscribe(cb: DevtoolsSubscriber): () => void;
};
declare class DevTools {
    private remoteDev?;
    private state;
    private defaultState;
    constructor();
    connectViaExtension(options?: DevtoolsOptions): DevtoolsConnection | undefined;
    /**
     * Registers an action that updated the current state of the storage
     *
     * @param type - name of the action
     * @param payload - data written to the storage
     * @param stateChanges - partial state that got updated after the changes
     */
    registerAction(type: string, payload: unknown, stateChanges?: Record<string, unknown> | null): void;
    initState(initialState?: Record<string, unknown>): void;
    /**
     * This clears the internal state of the DevTools, preserving the keys included in `keysToPreserve`
     */
    clearState(keysToPreserve?: string[]): void;
}
declare const _default: DevTools;
export default _default;
export type { DevtoolsConnection };
