import type {IDevTools, DevtoolsConnection} from './DevTools/types';
import RealDevTools from './DevTools/RealDevTools';
import NoOpDevTools from './DevTools/NoOpDevTools';

// Start with a no-op instance
let devToolsInstance: IDevTools = new NoOpDevTools();

/**
 * Initializes DevTools with the given enabled flag
 */
function initDevTools(enabled: boolean): void {
    devToolsInstance = enabled ? new RealDevTools() : new NoOpDevTools();
}

/**
 * Export a default object that delegates to the current devToolsInstance
 * This allows the instance to be swapped out while keeping the same import signature
 */
const DevTools: IDevTools = {
    registerAction(type: string, payload: unknown, stateChanges: Record<string, unknown> | null = {}) {
        devToolsInstance.registerAction(type, payload, stateChanges);
    },
    initState(initialState: Record<string, unknown> = {}) {
        devToolsInstance.initState(initialState);
    },
    clearState(keysToPreserve: string[] = []) {
        devToolsInstance.clearState(keysToPreserve);
    },
};

export default DevTools;
export {initDevTools};
export type {DevtoolsConnection, IDevTools};
