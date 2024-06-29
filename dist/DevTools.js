"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ERROR_LABEL = 'Onyx DevTools - Error: ';
class DevTools {
    constructor() {
        this.remoteDev = this.connectViaExtension();
        this.state = {};
        this.defaultState = {};
    }
    connectViaExtension(options) {
        try {
            // We don't want to augment the window type in a library code, so we use type assertion instead
            // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
            const reduxDevtools = typeof window === 'undefined' ? undefined : window.__REDUX_DEVTOOLS_EXTENSION__;
            if ((options === null || options === void 0 ? void 0 : options.remote) || !reduxDevtools) {
                return;
            }
            return reduxDevtools.connect(options);
        }
        catch (e) {
            console.error(ERROR_LABEL, e);
        }
    }
    /**
     * Registers an action that updated the current state of the storage
     *
     * @param type - name of the action
     * @param payload - data written to the storage
     * @param stateChanges - partial state that got updated after the changes
     */
    registerAction(type, payload, stateChanges = {}) {
        try {
            if (!this.remoteDev) {
                return;
            }
            const newState = Object.assign(Object.assign({}, this.state), stateChanges);
            this.remoteDev.send({ type, payload }, newState);
            this.state = newState;
        }
        catch (e) {
            console.error(ERROR_LABEL, e);
        }
    }
    initState(initialState = {}) {
        try {
            if (!this.remoteDev) {
                return;
            }
            this.remoteDev.init(initialState);
            this.state = initialState;
            this.defaultState = initialState;
        }
        catch (e) {
            console.error(ERROR_LABEL, e);
        }
    }
    /**
     * This clears the internal state of the DevTools, preserving the keys included in `keysToPreserve`
     */
    clearState(keysToPreserve = []) {
        const newState = Object.entries(this.state).reduce((obj, [key, value]) => {
            // eslint-disable-next-line no-param-reassign
            obj[key] = keysToPreserve.includes(key) ? value : this.defaultState[key];
            return obj;
        }, {});
        this.registerAction('CLEAR', undefined, newState);
    }
}
exports.default = new DevTools();
