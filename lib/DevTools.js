import _ from 'underscore';

const ERROR_LABEL = 'Onyx DevTools - Error: ';

/* eslint-disable no-underscore-dangle */
class DevTools {
    constructor() {
        this.remoteDev = this.connectViaExtension();
        this.state = {};
        this.defaultState = {};
    }

    connectViaExtension(options) {
        try {
            if ((options && options.remote) || typeof window === 'undefined' || !window.__REDUX_DEVTOOLS_EXTENSION__) {
                return;
            }
            return window.__REDUX_DEVTOOLS_EXTENSION__.connect(options);
        } catch (e) {
            console.error(ERROR_LABEL, e);
        }
    }

    /**
     * Registers an action that updated the current state of the storage
     *
     * @param {string} type - name of the action
     * @param {any} payload - data written to the storage
     * @param {object} stateChanges - partial state that got updated after the changes
     */
    registerAction(type, payload = undefined, stateChanges = {}) {
        try {
            if (!this.remoteDev) {
                return;
            }
            const newState = {
                ...this.state,
                ...stateChanges,
            };
            this.remoteDev.send({type, payload}, newState);
            this.state = newState;
        } catch (e) {
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
        } catch (e) {
            console.error(ERROR_LABEL, e);
        }
    }

    /**
     * This clears the internal state of the DevTools, preserving the keys included in `keysToPreserve`
     *
     * @param {string[]} keysToPreserve
     */
    clearState(keysToPreserve = []) {
        const newState = _.mapObject(this.state, (value, key) => (keysToPreserve.includes(key) ? value : this.defaultState[key]));
        this.registerAction('CLEAR', undefined, newState);
    }
}

export default new DevTools();
