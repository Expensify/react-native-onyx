import _ from 'underscore';

/* eslint-disable no-underscore-dangle */
class DevTools {
    constructor() {
        this.remoteDev = this.connectViaExtension();
    }

    connectViaExtension(options) {
        if ((options && options.remote) || typeof window === 'undefined' || !window.__REDUX_DEVTOOLS_EXTENSION__) {
            return;
        }
        return window.__REDUX_DEVTOOLS_EXTENSION__.connect(options);
    }

    /**
     * Registers an action that updated the current state of the storage
     *
     * @param {string} type - name of the action
     * @param {any} payload - data written to the storage
     * @param {object} stateChanges - partial state that got updated after the changes
     */
    registerAction(type, payload = undefined, stateChanges = {}) {
        const newState = {
            ...this.state,
            ...stateChanges,
        };

        this.remoteDev.send({type, payload}, newState);
        this.state = newState;
    }

    initState(initialState = {}) {
        this.remoteDev.init(initialState);
        this.state = initialState;
    }

    /**
     * This clears the internal state of the DevTools, preserving the keys included in `keysToPreserve`
     *
     * @param {string[]} keysToPreserve
     */
    clearState(keysToPreserve = []) {
        this.registerAction('CLEAR', undefined, _.pick(this.state, keysToPreserve));
    }
}

export default new DevTools();
