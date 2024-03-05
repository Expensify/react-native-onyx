declare const _default: DevTools;
export default _default;
declare class DevTools {
    remoteDev: any;
    state: {};
    defaultState: {};
    connectViaExtension(options: any): any;
    /**
     * Registers an action that updated the current state of the storage
     *
     * @param {string} type - name of the action
     * @param {any} payload - data written to the storage
     * @param {object} stateChanges - partial state that got updated after the changes
     */
    registerAction(type: string, payload?: any, stateChanges?: object): void;
    initState(initialState?: {}): void;
    /**
     * This clears the internal state of the DevTools, preserving the keys included in `keysToPreserve`
     *
     * @param {string[]} keysToPreserve
     */
    clearState(keysToPreserve?: string[]): void;
}
